import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.core.config import settings


def _get_base_html_template(header_color: str, title: str, content: str) -> str:
    """
    Returns the base HTML template with the given header color and content.
    """
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                margin: 0;
                padding: 0;
                background-color: #f8f9fa;
            }}
            .container {{
                max-width: 600px;
                margin: 40px auto;
                background-color: #ffffff;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                border: 1px solid #e2e8f0;
            }}
            .header {{
                background: {header_color};
                padding: 30px;
                text-align: center;
                color: white;
            }}
            .header h2 {{
                margin: 0;
                font-size: 24px;
                font-weight: 700;
                letter-spacing: 0.5px;
            }}
            .header p {{
                margin: 5px 0 0;
                opacity: 0.9;
                font-size: 14px;
                font-weight: 500;
            }}
            .content {{
                padding: 40px 30px;
                background: white;
            }}
            .footer {{
                background: #f1f5f9;
                padding: 20px;
                text-align: center;
                font-size: 12px;
                color: #94a3b8;
                border-top: 1px solid #e2e8f0;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h2>DATAVISION TCHAD</h2>
                <p>INSEED Platform Support</p>
            </div>
            <div class="content">
                {content}
            </div>
            <div class="footer">
                &copy; 2026 INSEED Tchad | N'Djamena
            </div>
        </div>
    </body>
    </html>
    """

def send_support_email(user_email: str, subject: str, message: str, user_name: str = "Unknown", user_role: str = "User", is_urgent: bool = False) -> bool:
    """
    Send HTML-formatted support email with priority logic.
    """
    try:
        msg = MIMEMultipart('alternative')
        msg['From'] = settings.MAIL_USERNAME
        msg['To'] = settings.MAIL_USERNAME
        msg['Subject'] = f"[DataVision Support] {subject}"
        msg.add_header('Reply-To', user_email)
        
        # Priority Logic
        header_gradient = "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" # Slate
        badge_bg = "#eff6ff"
        badge_text = "#1e40af"
        priority_label = "Standard Support"
        
        if is_urgent or "URGENT" in subject.upper():
            msg['X-Priority'] = '1'
            msg['Importance'] = 'High'
            badge_bg = "#fef2f2"
            badge_text = "#991b1b"
            priority_label = "URGENT - DATA ISSUE"
            # header_gradient = "linear-gradient(135deg, #991b1b 0%, #7f1d1d 100%)" # Red for urgent? User said Indigo/Slate for reports.
        
        # Content Body
        content_html = f"""
            <div style="display: inline-block; padding: 6px 16px; border-radius: 9999px; font-size: 11px; font-weight: 800; text-transform: uppercase; background: {badge_bg}; color: {badge_text}; margin-bottom: 24px;">
                {priority_label}
            </div>
            <p style="margin: 0 0 8px; font-size: 14px; color: #64748b;">REPORTED BY</p>
            <p style="margin: 0 0 24px; font-size: 16px; font-weight: 600; color: #0f172a;">
                {user_name} <span style="font-weight: 400; color: #64748b;">({user_role})</span> <br>
                <span style="font-size: 14px; font-weight: 400; color: #3b82f6;">{user_email}</span>
            </p>
            
            <p style="margin: 0 0 8px; font-size: 14px; color: #64748b;">SUBJECT</p>
            <p style="margin: 0 0 24px; font-size: 16px; font-weight: 600; color: #0f172a;">{subject}</p>
            
            <div style="background-color: #f8fafc; border-left: 4px solid {badge_text}; padding: 24px; border-radius: 8px; font-style: italic; color: #334155; line-height: 1.6;">
                "{message.replace(chr(10), '<br>')}"
            </div>
        """
        
        html_body = _get_base_html_template(header_gradient, "DataVision Tchad", content_html)
        
        msg.attach(MIMEText(html_body, 'html'))
        
        # SMTP Send
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
        server.send_message(msg)
        server.quit()
        
        return True
    except Exception as e:
        print(f"Failed to send support email: {str(e)}")
        return False

def send_resolution_email(user_email: str, user_name: str, subject: str, resolved_at: str) -> bool:
    """
    Send resolution notification to the analyst.
    """
    try:
        msg = MIMEMultipart('alternative')
        msg['From'] = settings.MAIL_USERNAME
        msg['To'] = user_email
        msg['Subject'] = f"[Resolved] {subject}"
        
        header_gradient = "linear-gradient(135deg, #059669 0%, #047857 100%)" # Emerald Green
        
        content_html = f"""
            <div style="text-align: center; margin-bottom: 30px;">
                <div style="display: inline-flex; align-items: center; justify-content: center; width: 64px; height: 64px; background-color: #ecfdf5; border-radius: 50%; color: #059669; font-size: 32px; margin-bottom: 16px;">
                    &#10003;
                </div>
                <h3 style="margin: 0; font-size: 20px; color: #0f172a;">Issue Resolved</h3>
                <p style="margin: 8px 0 0; color: #64748b; font-size: 14px;">Fixed on {resolved_at}</p>
            </div>
            
            <p style="font-size: 16px; color: #334155; line-height: 1.6;">
                Hello <strong>{user_name}</strong>,
            </p>
            <p style="font-size: 16px; color: #334155; line-height: 1.6;">
                The issue you reported regarding <strong>"{subject}"</strong> has been reviewed and corrected by the Administrator. Currently, no further action is required from you.
            </p>
            
            <div style="margin-top: 32px; text-align: center;">
                <a href="#" style="display: inline-block; padding: 14px 32px; background-color: #0f172a; color: white; text-decoration: none; font-weight: 600; border-radius: 8px; font-size: 14px;">
                    Back to Dashboard
                </a>
            </div>
        """
        
        html_body = _get_base_html_template(header_gradient, "DataVision Tchad", content_html)
        msg.attach(MIMEText(html_body, 'html'))
        
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
        server.send_message(msg)
        server.quit()
        return True
    except Exception as e:
        print(f"Failed to send resolution email: {str(e)}")
        return False
