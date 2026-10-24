package com.repcount.app;

import android.os.Bundle;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    // The WebView scales all text by the system font size, which pushes text in the
    // compact workout tables into each other. Allow a little scaling, but cap it.
    private static final int MAX_TEXT_ZOOM = 110;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebSettings settings = getBridge().getWebView().getSettings();
        settings.setTextZoom(Math.min(settings.getTextZoom(), MAX_TEXT_ZOOM));
    }
}
