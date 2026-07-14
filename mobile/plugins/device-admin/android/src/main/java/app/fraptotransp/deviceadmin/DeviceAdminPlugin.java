package app.fraptotransp.deviceadmin;

import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "FraptoDeviceAdmin")
public class DeviceAdminPlugin extends Plugin {

    private ComponentName admin() {
        return new ComponentName(getContext(), FraptoAdminReceiver.class);
    }

    private DevicePolicyManager dpm() {
        return (DevicePolicyManager) getContext()
                .getSystemService(Context.DEVICE_POLICY_SERVICE);
    }

    @PluginMethod
    public void isAdminActive(PluginCall call) {
        DevicePolicyManager dpm = dpm();
        JSObject ret = new JSObject();
        ret.put("active", dpm != null && dpm.isAdminActive(admin()));
        call.resolve(ret);
    }

    @PluginMethod
    public void requestAdmin(PluginCall call) {
        Intent intent = new Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN);
        intent.putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, admin());
        intent.putExtra(
            DevicePolicyManager.EXTRA_ADD_EXPLANATION,
            "Ativar para impedir a desinstalacao acidental do app de rastreio."
        );
        getActivity().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void removeAdmin(PluginCall call) {
        DevicePolicyManager dpm = dpm();
        if (dpm != null && dpm.isAdminActive(admin())) {
            dpm.removeActiveAdmin(admin());
        }
        call.resolve();
    }
}
