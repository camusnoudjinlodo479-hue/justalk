package com.example.justalk

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.net.http.SslError
import android.os.Bundle
import android.util.Log
import android.view.ViewGroup
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.SslErrorHandler
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.app.ActivityCompat
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import java.util.concurrent.Executor

class MainActivity : FragmentActivity() {
  private var uploadMessage: ValueCallback<Array<Uri>>? = null
  private val FILECHOOSER_RESULTCODE = 100
  private lateinit var webView: WebView

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    // Request permissions at startup
    ActivityCompat.requestPermissions(
      this,
      arrayOf(
        Manifest.permission.CAMERA,
        Manifest.permission.RECORD_AUDIO
      ),
      1
    )

    // Enable remote debugging of WebView via chrome://inspect
    WebView.setWebContentsDebuggingEnabled(true)

    // Create WebView programmatically to ensure it fills the screen and renders correctly
    webView = WebView(this).apply {
      layoutParams = ViewGroup.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT
      )
      
      settings.javaScriptEnabled = true
      settings.domStorageEnabled = true
      settings.allowContentAccess = true
      settings.allowFileAccess = true
      settings.mediaPlaybackRequiresUserGesture = false
      settings.databaseEnabled = true
      
      // Register Javascript interface for Biometric authentication
      addJavascriptInterface(BiometricBridge(this@MainActivity, this), "AndroidBridge")
      
      webViewClient = object : WebViewClient() {
        override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
          super.onPageStarted(view, url, favicon)
          Log.d("JustalkWebView", "Page load started: $url")
        }

        override fun onPageFinished(view: WebView?, url: String?) {
          super.onPageFinished(view, url)
          Log.d("JustalkWebView", "Page load finished: $url")
        }

        override fun onReceivedError(
          view: WebView?,
          errorCode: Int,
          description: String?,
          failingUrl: String?
        ) {
          Log.e("JustalkWebView", "Error loading page: $errorCode - $description for $failingUrl")
        }

        override fun onReceivedSslError(
          view: WebView?,
          handler: SslErrorHandler?,
          error: SslError?
        ) {
          Log.e("JustalkWebView", "SSL Error: ${error?.toString()}")
          // Proceed despite SSL errors
          handler?.proceed()
        }
      }

      webChromeClient = object : WebChromeClient() {
        override fun onPermissionRequest(request: PermissionRequest) {
          request.grant(request.resources)
        }

        override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
          Log.d("JustalkWebViewConsole", "${consoleMessage?.message()} -- From line ${consoleMessage?.lineNumber()} of ${consoleMessage?.sourceId()}")
          return true
        }

        override fun onShowFileChooser(
          webView: WebView?,
          filePathCallback: ValueCallback<Array<Uri>>?,
          fileChooserParams: FileChooserParams?
        ): Boolean {
          uploadMessage?.onReceiveValue(null)
          uploadMessage = filePathCallback
          val intent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
            type = "*/*"
            addCategory(Intent.CATEGORY_OPENABLE)
          }
          try {
            startActivityForResult(intent, FILECHOOSER_RESULTCODE)
          } catch (e: Exception) {
            uploadMessage = null
            return false
          }
          return true
        }
      }
      
      // Load the production website
      loadUrl("https://justalk.onrender.com")
    }

    setContentView(webView)
  }

  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)
    if (requestCode == FILECHOOSER_RESULTCODE) {
      if (uploadMessage == null) return
      val result = WebChromeClient.FileChooserParams.parseResult(resultCode, data)
      uploadMessage?.onReceiveValue(result)
      uploadMessage = null
    }
  }

  // Handle back button presses in the WebView
  override fun onBackPressed() {
    if (::webView.isInitialized && webView.canGoBack()) {
      webView.goBack()
    } else {
      super.onBackPressed()
    }
  }
}

// Javascript bridge class to expose native biometric prompt to JavaScript
class BiometricBridge(private val activity: FragmentActivity, private val webView: WebView) {
  private val executor: Executor = ContextCompat.getMainExecutor(activity)

  @JavascriptInterface
  fun showBiometricPrompt(callbackName: String) {
    activity.runOnUiThread {
      val biometricPrompt = BiometricPrompt(activity, executor,
        object : BiometricPrompt.AuthenticationCallback() {
          override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
            super.onAuthenticationError(errorCode, errString)
            Log.e("BiometricBridge", "Biometric error: $errString")
            webView.evaluateJavascript("javascript:$callbackName(false, '$errString')", null)
          }

          override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
            super.onAuthenticationSucceeded(result)
            Log.d("BiometricBridge", "Biometric verification successful")
            webView.evaluateJavascript("javascript:$callbackName(true, '')", null)
          }

          override fun onAuthenticationFailed() {
            super.onAuthenticationFailed()
            Log.w("BiometricBridge", "Biometric verification failed")
            webView.evaluateJavascript("javascript:$callbackName(false, 'Empreinte/Face ID non reconnue')", null)
          }
        })

      val promptInfo = BiometricPrompt.PromptInfo.Builder()
        .setTitle("Authentification Justalk")
        .setSubtitle("Veuillez valider avec votre empreinte digitale ou reconnaissance faciale")
        .setNegativeButtonText("Annuler")
        .build()

      biometricPrompt.authenticate(promptInfo)
    }
  }
}
