package ph.kitaph.nano

import com.google.mlkit.genai.common.DownloadStatus
import com.google.mlkit.genai.common.FeatureStatus
import com.google.mlkit.genai.prompt.GenerateContentRequest
import com.google.mlkit.genai.prompt.Generation
import com.google.mlkit.genai.prompt.GenerativeModel
import com.google.mlkit.genai.prompt.TextPart
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Bridge to Gemini Nano, the language model built into Android (AICore), via the ML Kit GenAI Prompt API.
 * KitaPH ships no model: Android provides it, and inference runs on this phone.
 */
class KitaNanoModule : Module() {
  private val model: GenerativeModel by lazy { Generation.getClient() }

  override fun definition() = ModuleDefinition {
    Name("KitaNano")
    Events("onDownloadProgress")

    AsyncFunction("checkStatus") Coroutine { ->
      when (model.checkStatus()) {
        FeatureStatus.AVAILABLE -> "available"
        FeatureStatus.DOWNLOADABLE -> "downloadable"
        FeatureStatus.DOWNLOADING -> "downloading"
        else -> "unavailable"
      }
    }

    AsyncFunction("getInfo") Coroutine { ->
      mapOf(
        "baseModel" to runCatching { model.getBaseModelName() }.getOrNull(),
        "tokenLimit" to runCatching { model.getTokenLimit() }.getOrNull(),
      )
    }

    AsyncFunction("download") Coroutine { ->
      var outcome = "started"
      model.download().collect { s ->
        when (s) {
          is DownloadStatus.DownloadStarted -> sendEvent("onDownloadProgress", mapOf("downloaded" to 0L, "total" to s.bytesToDownload))
          is DownloadStatus.DownloadProgress -> sendEvent("onDownloadProgress", mapOf("downloaded" to s.totalBytesDownloaded))
          is DownloadStatus.DownloadCompleted -> outcome = "completed"
          is DownloadStatus.DownloadFailed -> throw s.e
        }
      }
      outcome
    }

    AsyncFunction("generate") Coroutine { system: String, prompt: String, temperature: Double, maxOutputTokens: Int ->
      // This API version has no separate system instruction, so the instructions lead the prompt.
      val text = if (system.isEmpty()) prompt else "$system\n\n$prompt"
      val builder = GenerateContentRequest.Builder(TextPart(text))
      builder.temperature = temperature.toFloat()
      builder.maxOutputTokens = maxOutputTokens
      val started = System.currentTimeMillis()
      val response = model.generateContent(builder.build())
      mapOf(
        "text" to (response.candidates.firstOrNull()?.text ?: ""),
        "ms" to (System.currentTimeMillis() - started),
      )
    }
  }
}
