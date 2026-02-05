import os
import smtplib
from email.message import EmailMessage
from pathlib import Path
from dotenv import load_dotenv

# This finds the absolute path to the .env file in your root folder
# Path is: app/utils/email.py -> ../../../.env
env_path = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

def send_otp_email(target_email, otp_code):
    # Retrieve from .env
    smtp_user = os.getenv("MAIL_USERNAME")
    raw_pass = os.getenv("MAIL_PASSWORD")
    
    # SAFETY CHECK: If MAIL_PASSWORD is None, stop here to avoid the crash
    if raw_pass is None:
        print("❌ ERROR: MAIL_PASSWORD not found in .env file!")
        return False
        
    smtp_pass = raw_pass.replace(" ", "") 
    smtp_server = "smtp.gmail.com"
    smtp_port = 587

    msg = EmailMessage()
    msg['Subject'] = "Verification Code - DataVision Tchad"
    msg['From'] = smtp_user
    msg['To'] = target_email
    msg.set_content(f"Hello,\n\nYour verification code for DataVision Tchad is: {otp_code}\n\nThis code is valid for 10 minutes.")

    try:
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls() 
        server.login(smtp_user, smtp_pass)
        server.send_message(msg)
        server.quit()
        print(f"✅ Email sent to {target_email}")
        return True
    except Exception as e:
        print(f"❌ SMTP Error: {e}")
        return False