package cn.jackq.messenger.network;

import android.util.Log;

import java.io.IOException;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.net.SocketException;
import java.net.UnknownHostException;

/**
 * Created on: 4/24/17.
 * Creator: Jack Q <qiaobo@outlook.com>
 */

public class PeerTransmission implements Runnable {
    private static final String TAG = "PeerTransmission";

    public interface PeerTransmissionListener {
        void onPackageReceived(byte[] data);
    }

    private int localPort = 42001;
    private DatagramSocket socket;
    private Thread thread;
    private boolean running = false;

    private PeerTransmissionListener listener;

    public PeerTransmission(PeerTransmissionListener listener) throws SocketException, UnknownHostException {
        this.listener = listener;

        Log.d(TAG, "PeerTransmission: Creating new UDP socket on port " + localPort);
        socket = new DatagramSocket(localPort);
        InetAddress inetAddress = InetAddress.getByName("127.0.0.1");
        socket.connect(inetAddress, 42001);

        running = true;

        thread = new Thread(this);
        thread.start();
    }

    public void createPackage() {

    }

    public void terminate(){
        if(thread==null)
            return;

        running = false;
        thread.interrupt();
        try {
            thread.join(0);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }

        socket.close();
    }

    @Override
    public void run() {
        Log.d(TAG, "run: start UDP transmission");
        byte[] receiveBuffer = new byte[1024];

        while (running) {
            DatagramPacket receivePackage = new DatagramPacket(receiveBuffer, receiveBuffer.length);

            try {
                socket.receive(receivePackage);
            } catch (IOException e) {
                e.printStackTrace();
                continue;
            }

            Log.d(TAG, "run: receive UDP package from " + receivePackage.getAddress() + ":" + receivePackage.getPort());
            if(this.listener != null)
                listener.onPackageReceived(receivePackage.getData());
        }

        Log.d(TAG, "run: UDP package closed");
    }
}