package com.octoai.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;

@CapacitorPlugin(name = "OctoDocument")
public class OctoDocumentPlugin extends Plugin {
    private File draft;
    private long size;
    private boolean choosing;

    @PluginMethod
    public synchronized void begin(PluginCall call) {
        if (draft != null) {
            call.reject("Finish the current save first.");
            return;
        }
        try {
            draft = File.createTempFile("octo-export-", ".tmp", getContext().getCacheDir());
            size = 0;
            call.resolve();
        } catch (IOException error) {
            call.reject("Could not prepare the file. Check available storage.");
        }
    }

    @PluginMethod
    public synchronized void append(PluginCall call) {
        String data = call.getString("data", "");
        if (draft == null || choosing || data.length() > 350000) {
            call.reject("Invalid file data.");
            return;
        }
        try {
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            if (size + bytes.length > 128L * 1024 * 1024) {
                call.reject("File exports are limited to 128 MB.");
                return;
            }
            try (OutputStream out = new FileOutputStream(draft, true)) {
                out.write(bytes);
            }
            size += bytes.length;
            call.resolve();
        } catch (IOException | IllegalArgumentException error) {
            call.reject("Could not prepare the file. Check available storage.");
        }
    }

    @PluginMethod
    public synchronized void finish(PluginCall call) {
        String name = call.getString("name", "");
        String type = call.getString("type", "");
        if (draft == null || choosing || name.length() > 120 || name.indexOf('/') >= 0
            || name.indexOf(92) >= 0 || !name.matches(".+\\.(pdf|docx|txt|md|html|json)")
            || !type.matches("(application|text)/[a-z0-9.+-]+")) {
            call.reject("Invalid filename or file type.");
            return;
        }
        choosing = true;
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE)
            .setType(type)
            .putExtra(Intent.EXTRA_TITLE, name);
        getBridge().executeOnMainThread(() -> {
            try {
                startActivityForResult(call, intent, "onSaved");
            } catch (RuntimeException error) {
                synchronized (this) {
                    clear();
                }
                call.reject("Could not open the Android file picker.");
            }
        });
    }

    @ActivityCallback
    private void onSaved(PluginCall call, ActivityResult result) {
        if (call == null) {
            synchronized (this) {
                clear();
            }
            return;
        }
        getBridge().execute(() -> writeResult(call, result));
    }

    private synchronized void writeResult(PluginCall call, ActivityResult result) {
        Uri uri = result.getData() == null ? null : result.getData().getData();
        try {
            if (result.getResultCode() != Activity.RESULT_OK || uri == null) {
                call.resolve(new JSObject().put("saved", false));
                return;
            }
            if (draft == null) throw new IOException("Export expired");
            try (FileInputStream in = new FileInputStream(draft);
                 OutputStream out = getContext().getContentResolver().openOutputStream(uri, "wt")) {
                if (out == null) throw new IOException("Destination unavailable");
                byte[] buffer = new byte[64 * 1024];
                int count;
                while ((count = in.read(buffer)) != -1) out.write(buffer, 0, count);
            }
            call.resolve(new JSObject().put("saved", true));
        } catch (IOException | SecurityException error) {
            call.reject("Could not save the file at the selected location.");
        } finally {
            clear();
        }
    }

    @PluginMethod
    public synchronized void discard(PluginCall call) {
        if (!choosing) clear();
        call.resolve();
    }

    @Override
    protected synchronized void handleOnDestroy() {
        clear();
    }

    private void clear() {
        if (draft != null) draft.delete();
        draft = null;
        choosing = false;
    }
}
