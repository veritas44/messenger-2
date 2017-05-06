package cn.jackq.messenger.network;

import android.os.Build;
import android.support.annotation.RequiresApi;
import android.util.Log;

import java.io.IOException;
import java.net.InetAddress;
import java.net.Socket;
import java.net.UnknownHostException;
import java.util.concurrent.FutureTask;

import java.util.concurrent.CompletableFuture;

import cn.jackq.messenger.network.protocol.ServerProtocol;
import cn.jackq.messenger.service.MainService;

public class ServerConnection {

    private static final String TAG = "ServerConnection";

    public interface ServerConnectionListener {
        // void onUserLoginResponse();
    }

    private ServerConnectionListener mListener;

    public ServerConnection(ServerConnectionListener listener) {
        this.mListener = listener;
    }

    public CompletableFuture<NetworkOperationStatus> connectServer() {
        return null;
    }

    @RequiresApi(api = Build.VERSION_CODES.N)
    public CompletableFuture<NetworkOperationStatus> testServer() {
        FutureTask<NetworkOperationStatus> task = new FutureTask<>(() -> NetworkOperationStatus.OK);
        return CompletableFuture.supplyAsync(() -> {
            try {
                InetAddress serverAddress = InetAddress.getByName("10.0.6.1");
                Socket socket = new Socket(serverAddress, 12121);

                socket.getOutputStream().write(ServerProtocol.packServerTestPacket());

                byte[] readBuffer = new byte[10240];
                int read = 0;
                while (ServerProtocol.isPartialPacket(readBuffer, read)) {
                    if (ServerProtocol.isFullPacket(readBuffer, read)) {
                        String message = ServerProtocol.unpackString(readBuffer);
                        socket.close();
                        return new NetworkOperationStatus(message, true);
                    }
                    read += socket.getInputStream().read(readBuffer);
                }
                socket.close();
                return new NetworkOperationStatus("Invalid response from server", false);
            } catch (UnknownHostException e) {
                Log.d(TAG, "testServer: failed to resolve text");
                e.printStackTrace();
            } catch (IOException e) {
                Log.d(TAG, "Network IO Exception");
                e.printStackTrace();
            }
            return new NetworkOperationStatus("Failed to connect to server", false);
        });
    }

    public static ServerConnection create(ServerConnectionListener listener) {
        return new ServerConnection(listener);
    }
}
