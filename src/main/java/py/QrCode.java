package py;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.WriterException;
import com.google.zxing.client.j2se.MatrixToImageConfig;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.net.URL;
import java.nio.file.*;
import java.util.Base64;
import java.util.Comparator;
import java.util.HashMap;
import java.util.Hashtable;
import java.util.Map;
import java.util.Random;

public class QrCode {

    private static final String LOGO = "/logo-32x32.png";

    public static String genQr(String content) throws Exception {
        return genQr(content, 250, 250);
    }
    public static String genQr(String content, int width, int height) throws Exception {
        // Create new configuration that specifies the error correction
        Hashtable hints = new Hashtable();
        hints.put(EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.H);
        hints.put(EncodeHintType.CHARACTER_SET, "UTF-8");
        QRCodeWriter writer = new QRCodeWriter();
        BitMatrix bitMatrix = null;
        ByteArrayOutputStream os = new ByteArrayOutputStream();

        // Create a qr code with the url as content and a size of WxH px
        bitMatrix = writer.encode(content, BarcodeFormat.QR_CODE, width, height, hints);

        // Load QR image
        BufferedImage qrImage = MatrixToImageWriter.toBufferedImage(bitMatrix);

        // Load logo image
        BufferedImage overly = ImageIO.read(Main.class.getResourceAsStream(LOGO));

        // Calculate the delta height and width between QR code and logo
        int deltaHeight = qrImage.getHeight() - overly.getHeight();
        int deltaWidth = qrImage.getWidth() - overly.getWidth();

        // Initialize combined image
        BufferedImage combined = new BufferedImage(qrImage.getHeight(), qrImage.getWidth(),
                BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = (Graphics2D) combined.getGraphics();

        // Write QR code to new image at position 0/0
        g.drawImage(qrImage, 0, 0, null);
        g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, 1f));

        // Write logo into combine image at position (deltaWidth / 2) and
        // (deltaHeight / 2). Background: Left/Right and Top/Bottom must be
        // the same space for the logo to be centered
        g.drawImage(overly, (int) Math.round(deltaWidth / 2), (int) Math.round(deltaHeight / 2), null);

        // Write combined image as PNG to OutputStream
        ImageIO.write(combined, "png", os);
        // Store Image
        var dataUrl = "data:image/png;base64," + Base64.getEncoder().encodeToString(os.toByteArray());

        return dataUrl;

    }

}
