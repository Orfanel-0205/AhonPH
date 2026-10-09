package ph.kitaph.ondevice

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import com.google.android.gms.tasks.Task
import com.google.mlkit.common.model.DownloadConditions
import com.google.mlkit.common.model.RemoteModelManager
import com.google.mlkit.genai.common.DownloadStatus
import com.google.mlkit.genai.common.FeatureStatus
import com.google.mlkit.genai.common.StreamingCallback
import com.google.mlkit.genai.prompt.GenerateContentRequest
import com.google.mlkit.genai.prompt.Generation
import com.google.mlkit.genai.prompt.GenerativeModel
import com.google.mlkit.genai.prompt.ImagePart
import com.google.mlkit.genai.prompt.TextPart
import com.google.mlkit.nl.languageid.LanguageIdentification
import com.google.mlkit.nl.languageid.LanguageIdentificationOptions
import com.google.mlkit.nl.translate.TranslateLanguage
import com.google.mlkit.nl.translate.TranslateRemoteModel
import com.google.mlkit.nl.translate.Translation
import com.google.mlkit.nl.translate.Translator
import com.google.mlkit.nl.translate.TranslatorOptions
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.suspendCancellableCoroutine

private const val MAX_OUTPUT_TOKENS = 256

private suspend fun <T> Task<T>.awaitResult(): T = suspendCancellableCoroutine { cont ->
  addOnSuccessListener { cont.resume(it) }
  addOnFailureListener { cont.resumeWithException(it) }
}

/**
 * Every AI model KitaPH uses on the phone, in one place. Nothing here touches the network except the
 * one-time model downloads (Gemini Nano via Android AICore, ML Kit translation packs).
 *  - Gemini Nano (Android's built-in LLM) through the ML Kit GenAI Prompt API
 *  - ML Kit on-device translation, with translators kept open between calls
 *  - ML Kit on-device language identification
 */
class KitaOnDeviceModule : Module() {
  private val nano: GenerativeModel by lazy { Generation.getClient() }
  private val translators = mutableMapOf<String, Translator>()
  private val languageId by lazy {
    LanguageIdentification.getClient(LanguageIdentificationOptions.Builder().setConfidenceThreshold(0.5f).build())
  }

  /** Decodes a photo at a size the on-device model can handle, without loading the full-resolution image. */
  private fun loadBitmap(uri: String, maxSide: Int): Bitmap {
    val ctx = appContext.reactContext ?: throw CodedException("App context unavailable")
    val u = Uri.parse(uri)
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    ctx.contentResolver.openInputStream(u).use { BitmapFactory.decodeStream(it, null, bounds) }
    var sample = 1
    while (maxOf(bounds.outWidth, bounds.outHeight) / sample > maxSide * 2) sample *= 2
    val bmp = ctx.contentResolver.openInputStream(u).use { BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample }) }
      ?: throw CodedException("Could not read the photo")
    val scale = maxSide.toFloat() / maxOf(bmp.width, bmp.height)
    return if (scale < 1f) Bitmap.createScaledBitmap(bmp, (bmp.width * scale).toInt(), (bmp.height * scale).toInt(), true) else bmp
  }

  private fun translator(source: String, target: String): Translator {
    val src = TranslateLanguage.fromLanguageTag(source) ?: throw CodedException("Unsupported language: $source")
    val tgt = TranslateLanguage.fromLanguageTag(target) ?: throw CodedException("Unsupported language: $target")
    return translators.getOrPut("$src>$tgt") {
      Translation.getClient(TranslatorOptions.Builder().setSourceLanguage(src).setTargetLanguage(tgt).build())
    }
  }

  override fun definition() = ModuleDefinition {
    Name("KitaOnDevice")
    Events("onNanoDownload", "onNanoText")

    OnDestroy {
      translators.values.forEach { it.close() }
      translators.clear()
    }

    // ---------- Gemini Nano ----------

    AsyncFunction("nanoStatus") Coroutine { ->
      when (nano.checkStatus()) {
        FeatureStatus.AVAILABLE -> "available"
        FeatureStatus.DOWNLOADABLE -> "downloadable"
        FeatureStatus.DOWNLOADING -> "downloading"
        else -> "unavailable"
      }
    }

    AsyncFunction("nanoInfo") Coroutine { ->
      mapOf(
        "baseModel" to runCatching { nano.getBaseModelName() }.getOrNull(),
        "tokenLimit" to runCatching { nano.getTokenLimit() }.getOrNull(),
      )
    }

    AsyncFunction("nanoDownload") Coroutine { ->
      var outcome = "started"
      nano.download().collect { s ->
        when (s) {
          is DownloadStatus.DownloadStarted -> sendEvent("onNanoDownload", mapOf("downloaded" to 0L, "total" to s.bytesToDownload))
          is DownloadStatus.DownloadProgress -> sendEvent("onNanoDownload", mapOf("downloaded" to s.totalBytesDownloaded))
          is DownloadStatus.DownloadCompleted -> outcome = "completed"
          is DownloadStatus.DownloadFailed -> throw s.e
        }
      }
      outcome
    }

    AsyncFunction("nanoWarmup") Coroutine { ->
      runCatching { nano.warmup() }.isSuccess
    }

    /** Streams text through onNanoText events tagged with requestId; resolves with the full answer. */
    AsyncFunction("nanoGenerate") Coroutine { requestId: String, prompt: String, temperature: Double, maxOutputTokens: Int ->
      val builder = GenerateContentRequest.Builder(TextPart(prompt))
      builder.temperature = temperature.toFloat()
      // Gemini Nano (Prompt API beta2) accepts 1..256 output tokens.
      builder.maxOutputTokens = maxOutputTokens.coerceIn(1, MAX_OUTPUT_TOKENS)
      val started = System.currentTimeMillis()
      var firstTokenMs = -1L
      val response = nano.generateContent(builder.build(), StreamingCallback { chunk ->
        if (firstTokenMs < 0) firstTokenMs = System.currentTimeMillis() - started
        sendEvent("onNanoText", mapOf("requestId" to requestId, "chunk" to chunk))
      })
      mapOf(
        "text" to (response.candidates.firstOrNull()?.text ?: ""),
        "ms" to (System.currentTimeMillis() - started),
        "firstTokenMs" to firstTokenMs,
      )
    }

    /** Gemini Nano looks at a photo (e.g. a receipt) and answers the prompt about it, on the phone. */
    AsyncFunction("nanoReadImage") Coroutine { uri: String, prompt: String, maxOutputTokens: Int ->
      val builder = GenerateContentRequest.Builder(ImagePart(loadBitmap(uri, 1024)), TextPart(prompt))
      builder.temperature = 0f
      builder.maxOutputTokens = maxOutputTokens.coerceIn(1, MAX_OUTPUT_TOKENS)
      val started = System.currentTimeMillis()
      val response = nano.generateContent(builder.build())
      mapOf("text" to (response.candidates.firstOrNull()?.text ?: ""), "ms" to (System.currentTimeMillis() - started))
    }

    // ---------- Translation (ML Kit, on-device) ----------

    AsyncFunction("downloadedLanguages") Coroutine { ->
      RemoteModelManager.getInstance().getDownloadedModels(TranslateRemoteModel::class.java).awaitResult().map { it.language }
    }

    /** Downloads the language packs once (about 30 MB each). After this, translation is fully offline. */
    AsyncFunction("prepareTranslation") Coroutine { source: String, target: String ->
      val started = System.currentTimeMillis()
      translator(source, target).downloadModelIfNeeded(DownloadConditions.Builder().build()).awaitResult()
      System.currentTimeMillis() - started
    }

    /** Translates many strings with one open translator. Fails fast if the packs are not downloaded yet. */
    AsyncFunction("translateBatch") Coroutine { texts: List<String>, source: String, target: String ->
      val started = System.currentTimeMillis()
      val t = translator(source, target)
      val out = texts.map { if (it.isBlank()) it else t.translate(it).awaitResult() }
      mapOf("texts" to out, "ms" to (System.currentTimeMillis() - started))
    }

    // ---------- Language identification (ML Kit, on-device) ----------

    AsyncFunction("identifyLanguage") Coroutine { text: String ->
      languageId.identifyLanguage(text).awaitResult()
    }
  }
}
