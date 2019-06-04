
package py;

import java.io.File;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Properties;

import javax.mail.Authenticator;
import javax.mail.Message;
import javax.mail.MessagingException;
import javax.mail.Multipart;
import javax.mail.PasswordAuthentication;
import javax.mail.Session;
import javax.mail.Transport;
import javax.mail.internet.InternetAddress;
import javax.mail.internet.MimeBodyPart;
import javax.mail.internet.MimeMessage;
import javax.mail.internet.MimeMultipart;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
public class Mail {
    private static final Logger logger = LoggerFactory.getLogger(Mail.class);
    public static void sendMail(String subject, String content, String to) throws Exception {
        if(to == null) to = Secret.adminEmail;
        Properties prop = new Properties();
        // prop.put("mail.smtp.starttls.enable", "true");
        // prop.put("mail.smtp.port", "587");
        prop.put("mail.smtp.host", Secret.mailHost);
        prop.put("mail.smtp.socketFactory.port", "465");
        prop.put("mail.smtp.socketFactory.class", "javax.net.ssl.SSLSocketFactory");
        prop.put("mail.smtp.auth", "true");
        prop.put("mail.smtp.timeout", "3000");    
        prop.put("mail.smtp.connectiontimeout", "3000");    
        Session session = Session.getDefaultInstance(prop, new Authenticator() {
            @Override
            protected PasswordAuthentication getPasswordAuthentication() {
                return new PasswordAuthentication(Secret.mailUser, Secret.mailPass);
            }
        });
        Message message = new MimeMessage(session);
        message.setFrom(new InternetAddress(Secret.mailUser, Secret.mailFromDesc));
        message.setRecipients(
        Message.RecipientType.TO, InternetAddress.parse(to));
        message.setSubject(subject);
        message.setSentDate(new Date());
        // message.setText(text, "utf-8", "html");
        message.setHeader("XPriority", "1");
        MimeBodyPart mimeBodyPart = new MimeBodyPart();
        mimeBodyPart.setContent(content, "text/html; charset=utf-8");
        Multipart multipart = new MimeMultipart();              
        multipart.addBodyPart(mimeBodyPart);
        // MimeBodyPart attachmentBodyPart = new MimeBodyPart();  
        // attachmentBodyPart.attachFile(new File("path/to/file"));
        // multipart.addBodyPart(attachmentBodyPart);
        message.setContent(multipart);       
        Transport.send(message);
        logger.info("Mail has been sent successfully");
    }
}
