package app.fraptotransp.deviceadmin;

import android.app.admin.DeviceAdminReceiver;

// Receiver do Device Admin. Não precisa de comportamento próprio — a mera
// existência como admin ATIVO já faz o Android bloquear a desinstalação.
public class FraptoAdminReceiver extends DeviceAdminReceiver {
}
