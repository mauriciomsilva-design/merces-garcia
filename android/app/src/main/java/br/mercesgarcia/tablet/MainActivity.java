package br.mercesgarcia.tablet;

import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;

public class MainActivity extends AppCompatActivity {
    private static final String PREFS = "merces_garcia";
    private static final String KEY_URL = "server_url";
    private LinearLayout setup;
    private WebView web;
    private EditText urlInput;

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        String saved = getSharedPreferences(PREFS, MODE_PRIVATE).getString(KEY_URL, "");
        if (saved.isEmpty()) showSetup(); else open(saved);
    }

    private void showSetup() {
        setup = new LinearLayout(this); setup.setOrientation(LinearLayout.VERTICAL); setup.setPadding(48,64,48,48); setup.setBackgroundColor(Color.rgb(11,16,32));
        TextView title = new TextView(this); title.setText("Mercês Garcia"); title.setTextColor(Color.WHITE); title.setTextSize(28); title.setPadding(0,0,0,20);
        TextView help = new TextView(this); help.setText("Digite o endereço do computador servidor na mesma Wi-Fi. Ex.: http://192.168.1.50:3000/tablet/"); help.setTextColor(Color.LTGRAY); help.setTextSize(16); help.setPadding(0,0,0,20);
        urlInput = new EditText(this); urlInput.setHint("http://IP-DO-COMPUTADOR:3000/tablet/"); urlInput.setTextColor(Color.WHITE); urlInput.setHintTextColor(Color.GRAY); urlInput.setSingleLine(true);
        Button connect = new Button(this); connect.setText("CONECTAR"); connect.setOnClickListener(v -> { String url=normalize(urlInput.getText().toString()); if(!url.isEmpty()){ getSharedPreferences(PREFS,MODE_PRIVATE).edit().putString(KEY_URL,url).apply(); open(url); } });
        Button change = new Button(this); change.setText("APAGAR SERVIDOR SALVO"); change.setOnClickListener(v -> urlInput.setText(""));
        setup.addView(title); setup.addView(help); setup.addView(urlInput); setup.addView(connect); setup.addView(change); setContentView(setup);
    }

    private String normalize(String value) { String s=value.trim(); if(s.isEmpty()) return ""; if(!s.startsWith("http://") && !s.startsWith("https://")) s="http://"+s; if(!s.endsWith("/")) s += "/"; return s; }

    private void open(String url) {
        web = new WebView(this); WebSettings s=web.getSettings(); s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true); s.setDatabaseEnabled(true); s.setAllowFileAccess(true); s.setMediaPlaybackRequiresUserGesture(false); s.setBuiltInZoomControls(false); s.setDisplayZoomControls(false);
        if (WebViewFeature.isFeatureSupported(WebViewFeature.FORCE_DARK)) WebSettingsCompat.setForceDark(s, WebSettingsCompat.FORCE_DARK_OFF);
        web.setWebChromeClient(new WebChromeClient()); web.setWebViewClient(new WebViewClient(){ @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r){ v.loadUrl(r.getUrl().toString()); return true; }});
        setContentView(web); web.loadUrl(url);
    }

    @Override public void onBackPressed() { if(web!=null && web.canGoBack()) web.goBack(); else super.onBackPressed(); }
}
