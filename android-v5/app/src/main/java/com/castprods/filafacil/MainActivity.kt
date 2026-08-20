package com.castprods.filafacil

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.net.http.SslError
import android.os.Bundle
import android.view.View
import android.webkit.CookieManager
import android.webkit.GeolocationPermissions
import android.webkit.SslErrorHandler
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.ProgressBar
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var progress: ProgressBar
    private lateinit var loadingPanel: View
    private lateinit var errorPanel: View

    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var pendingGeoOrigin: String? = null
    private var pendingGeoCallback: GeolocationPermissions.Callback? = null

    private val homeUrl = "https://fila-facil-andreyribeiro392-coders-projects.vercel.app/"
    private val officialHost = "fila-facil-andreyribeiro392-coders-projects.vercel.app"

    private val filePicker = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val callback = fileCallback ?: return@registerForActivityResult
        val uris = WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
        callback.onReceiveValue(uris)
        fileCallback = null
    }

    private val locationPermission = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { grants ->
        val allowed = grants[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
            grants[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        pendingGeoCallback?.invoke(pendingGeoOrigin, allowed, false)
        pendingGeoCallback = null
        pendingGeoOrigin = null
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WebView.setWebContentsDebuggingEnabled(false)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        progress = findViewById(R.id.progress)
        loadingPanel = findViewById(R.id.loadingPanel)
        errorPanel = findViewById(R.id.errorPanel)

        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, false)
        }

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = false
            setGeolocationEnabled(true)
            loadsImagesAutomatically = true
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            cacheMode = WebSettings.LOAD_DEFAULT
            setSupportMultipleWindows(false)
            javaScriptCanOpenWindowsAutomatically = false
            mediaPlaybackRequiresUserGesture = true
            saveFormData = false
            safeBrowsingEnabled = true
            userAgentString = "$userAgentString FilaFacil/5.0"
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, value: Int) {
                progress.progress = value
                progress.visibility = if (value in 1..99) View.VISIBLE else View.GONE
            }

            override fun onGeolocationPermissionsShowPrompt(origin: String, callback: GeolocationPermissions.Callback) {
                val originHost = runCatching { Uri.parse(origin).host }.getOrNull()
                if (originHost != officialHost) {
                    callback.invoke(origin, false, false)
                    return
                }

                val fine = ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.ACCESS_FINE_LOCATION)
                val coarse = ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.ACCESS_COARSE_LOCATION)
                if (fine == PackageManager.PERMISSION_GRANTED || coarse == PackageManager.PERMISSION_GRANTED) {
                    callback.invoke(origin, true, false)
                } else {
                    pendingGeoOrigin = origin
                    pendingGeoCallback = callback
                    locationPermission.launch(arrayOf(
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                    ))
                }
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                if (filePathCallback == null) return false
                fileCallback?.onReceiveValue(null)
                fileCallback = filePathCallback

                val intent = runCatching { fileChooserParams?.createIntent() }.getOrNull() ?: Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "image/*"
                }
                intent.addCategory(Intent.CATEGORY_OPENABLE)
                if (intent.type == null || intent.type == "*/*") intent.type = "image/*"
                return runCatching {
                    filePicker.launch(intent)
                    true
                }.getOrElse {
                    fileCallback?.onReceiveValue(null)
                    fileCallback = null
                    false
                }
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (!request.isForMainFrame) return false
                val uri = request.url
                val scheme = uri.scheme?.lowercase()
                val host = uri.host?.lowercase()

                if (scheme == "https" && host == officialHost) return false

                if (scheme == "https" || scheme == "http") {
                    openExternal(uri)
                    return true
                }

                if (scheme in setOf("tel", "mailto", "geo", "whatsapp")) {
                    openExternal(uri)
                }
                return true
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                errorPanel.visibility = View.GONE
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                loadingPanel.animate().alpha(0f).setDuration(220).withEndAction {
                    loadingPanel.visibility = View.GONE
                    loadingPanel.alpha = 1f
                }.start()
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) showConnectionError()
            }

            override fun onReceivedSslError(view: WebView?, handler: SslErrorHandler, error: SslError?) {
                handler.cancel()
                showConnectionError()
            }
        }

        findViewById<Button>(R.id.retryButton).setOnClickListener {
            errorPanel.visibility = View.GONE
            loadingPanel.visibility = View.VISIBLE
            webView.loadUrl(homeUrl)
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack() else finish()
            }
        })

        if (savedInstanceState == null) {
            webView.loadUrl(homeUrl)
        } else {
            webView.restoreState(savedInstanceState)
            loadingPanel.visibility = View.GONE
        }
    }

    private fun openExternal(uri: Uri) {
        runCatching {
            startActivity(Intent(Intent.ACTION_VIEW, uri).apply {
                addCategory(Intent.CATEGORY_BROWSABLE)
            })
        }
    }

    private fun showConnectionError() {
        loadingPanel.visibility = View.GONE
        progress.visibility = View.GONE
        errorPanel.visibility = View.VISIBLE
    }

    override fun onSaveInstanceState(outState: Bundle) {
        webView.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    override fun onDestroy() {
        fileCallback?.onReceiveValue(null)
        fileCallback = null
        pendingGeoCallback?.invoke(pendingGeoOrigin, false, false)
        pendingGeoCallback = null
        pendingGeoOrigin = null
        webView.stopLoading()
        webView.destroy()
        super.onDestroy()
    }
}
