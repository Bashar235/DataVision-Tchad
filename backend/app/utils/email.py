import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pathlib import Path
from dotenv import load_dotenv

# Resolve .env from: app/utils/email.py -> ../../../.env
env_path = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(dotenv_path=env_path)


def _build_otp_html(username: str, otp_code: str) -> str:
    """
    Build a polished, minimalist Apple-inspired HTML transactional email
    for OTP verification. Compliant with Gmail, Outlook, and Apple Mail.
    """
    # Use first name only for a warmer greeting
    first_name = username.split()[0] if username else "Utilisateur"

    return f"""<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Code de Vérification — DataVision Tchad</title>
  <!--[if mso]>
  <noscript>
    <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">

  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
         style="background-color:#F9FAFB;padding:40px 16px;">
    <tr>
      <td align="center">

        <!-- Card -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
               style="max-width:560px;background-color:#FFFFFF;border-radius:12px;
                      box-shadow:0 4px 24px rgba(0,0,0,0.07),0 1px 4px rgba(0,0,0,0.04);
                      overflow:hidden;">

          <!-- ═══════════════════════════════════════════
               CHAD FLAG ACCENT BAR  (Blue | Gold | Red)
               ═══════════════════════════════════════════ -->
          <tr>
            <td height="5" style="padding:0;line-height:0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td width="33.33%" height="5" bgcolor="#003082" style="line-height:5px;">&nbsp;</td>
                  <td width="33.33%" height="5" bgcolor="#FECB00" style="line-height:5px;">&nbsp;</td>
                  <td width="33.34%" height="5" bgcolor="#C8102E" style="line-height:5px;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ═══════════════════
               HEADER / BRANDING
               ═══════════════════ -->
          <tr>
            <td align="center" style="padding:36px 40px 24px;">

              <!-- INSEED Logo placeholder (SVG shield emblem) -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center">
                    <div style="display:inline-block;">
                      <svg xmlns="http://www.w3.org/2000/svg" width="52" height="60"
                           viewBox="0 0 52 60" fill="none"
                           style="display:block;margin:0 auto 10px;">
                        <!-- Shield body -->
                        <path d="M26 2L4 12V30C4 43.3 13.6 55.4 26 58C38.4 55.4 48 43.3 48 30V12L26 2Z"
                              fill="#1E3A8A" stroke="#1E3A8A" stroke-width="1"/>
                        <!-- Inner shield highlight -->
                        <path d="M26 9L10 17.5V30C10 40.2 17.2 49.4 26 52C34.8 49.4 42 40.2 42 30V17.5L26 9Z"
                              fill="#2563EB" opacity="0.4"/>
                        <!-- Stylised 'I' for INSEED -->
                        <text x="26" y="36" text-anchor="middle"
                              font-family="'Helvetica Neue',Arial,sans-serif"
                              font-size="20" font-weight="700"
                              fill="#FFFFFF" letter-spacing="0.5">I</text>
                      </svg>
                    </div>
                    <div style="font-size:13px;font-weight:700;letter-spacing:2.5px;
                                color:#1E3A8A;text-transform:uppercase;margin-top:2px;">
                      INSEED TCHAD
                    </div>
                    <div style="font-size:10px;font-weight:500;letter-spacing:1.5px;
                                color:#6B7280;text-transform:uppercase;margin-top:3px;">
                      Institut National de la Statistique, des Études Économiques et Démographiques
                    </div>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Thin divider -->
          <tr>
            <td style="padding:0 40px;">
              <div style="height:1px;background:linear-gradient(90deg,transparent,#E5E7EB,transparent);"></div>
            </td>
          </tr>

          <!-- ═══════════════════════
               PERSONALISED GREETING
               ═══════════════════════ -->
          <tr>
            <td style="padding:32px 40px 0;">
              <p style="margin:0 0 6px;font-size:22px;font-weight:700;color:#111827;line-height:1.3;">
                Bonjour, {first_name}&nbsp;👋
              </p>
              <p style="margin:0;font-size:14px;color:#6B7280;line-height:1.6;">
                Sécurisation de votre accès à la plateforme officielle<br/>
                d'intelligence démographique.
              </p>
              <p style="margin:4px 0 0;font-size:12px;color:#9CA3AF;font-style:italic;">
                Securing your access to the official demographic intelligence platform.
              </p>
            </td>
          </tr>

          <!-- ════════════════════════
               OTP CODE BLOCK
               ════════════════════════ -->
          <tr>
            <td align="center" style="padding:28px 40px 24px;">

              <p style="margin:0 0 12px;font-size:13px;font-weight:600;
                        letter-spacing:1px;text-transform:uppercase;color:#6B7280;">
                Votre code de vérification / Your verification code
              </p>

              <!-- Pill box for OTP -->
              <div style="display:inline-block;background:#F3F4F6;
                          padding:16px 32px;border-radius:10px;
                          border:1.5px solid #E5E7EB;margin:0 auto;">
                <span style="font-family:'Courier New',Courier,monospace;
                             font-size:34px;font-weight:700;letter-spacing:8px;
                             color:#111827;display:block;text-align:center;
                             line-height:1.2;">
                  {otp_code}
                </span>
              </div>

            </td>
          </tr>

          <!-- ════════════════════════
               SECURITY NOTICE
               ════════════════════════ -->
          <tr>
            <td style="padding:0 40px 32px;">

              <!-- Expiry notice pill -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0"
                     style="margin:0 auto 20px;">
                <tr>
                  <td style="background:#EFF6FF;border-radius:20px;
                              padding:8px 18px;text-align:center;">
                    <span style="font-size:13px;font-weight:600;color:#1D4ED8;">
                      ⏱ Valide pendant 10 minutes &nbsp;·&nbsp; Valid for 10 minutes
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Warning box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="background:#FFFBEB;border-left:3px solid #F59E0B;
                              border-radius:6px;padding:14px 18px;">
                    <p style="margin:0;font-size:13px;color:#92400E;line-height:1.6;">
                      🔒 &nbsp;<strong>Ne partagez jamais ce code.</strong>
                      L'équipe INSEED ne vous demandera jamais votre code de vérification.<br/>
                      <span style="color:#B45309;">
                        Never share this code. INSEED staff will never ask for it.
                      </span>
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- ════════════════════════
               FOOTER
               ════════════════════════ -->
          <tr>
            <td style="padding:0 40px;">
              <div style="height:1px;background:#E5E7EB;"></div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 40px 28px;background:#F9FAFB;border-radius:0 0 12px 12px;">

              <!-- Chad flag stripe (mini) -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0"
                     style="margin:0 auto 14px;">
                <tr>
                  <td width="20" height="3" bgcolor="#003082" style="border-radius:2px 0 0 2px;">&nbsp;</td>
                  <td width="20" height="3" bgcolor="#FECB00">&nbsp;</td>
                  <td width="20" height="3" bgcolor="#C8102E" style="border-radius:0 2px 2px 0;">&nbsp;</td>
                </tr>
              </table>

              <p style="margin:0 0 4px;font-size:11px;font-weight:800;letter-spacing:2.5px;
                        text-transform:uppercase;color:#374151;">
                DATAVISION TCHAD
              </p>
              <p style="margin:0;font-size:11px;color:#9CA3AF;">
                Plateforme nationale d'intelligence démographique
              </p>
              <p style="margin:8px 0 0;font-size:11px;color:#D1D5DB;">
                © 2026 INSEED Tchad. Tous droits réservés.
              </p>

            </td>
          </tr>

        </table>
        <!-- /Card -->

        <!-- Below-card note -->
        <p style="margin:20px 0 0;font-size:11px;color:#9CA3AF;text-align:center;max-width:400px;">
          Si vous n'avez pas demandé ce code, ignorez cet e-mail.<br/>
          If you did not request this code, please ignore this email.
        </p>

      </td>
    </tr>
  </table>

</body>
</html>"""


def send_otp_email(target_email: str, otp_code: str, username: str = "Utilisateur") -> bool:
    """
    Send a polished HTML OTP verification email to the given address.
    MIME type is explicitly set to text/html for full CSS rendering support
    across Gmail, Outlook, and Apple Mail.
    """
    smtp_user = os.getenv("MAIL_USERNAME")
    raw_pass  = os.getenv("MAIL_PASSWORD")

    if not smtp_user or raw_pass is None:
        print("❌ ERROR: MAIL_USERNAME or MAIL_PASSWORD not found in .env file!")
        return False

    smtp_pass = raw_pass.replace(" ", "")

    # Build the multipart/alternative message with only HTML part
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "🔐 Code de vérification — DataVision Tchad"
    msg["From"]    = smtp_user
    msg["To"]      = target_email

    # Plain-text fallback (for very old clients)
    plain_text = (
        f"Bonjour {username},\n\n"
        f"Votre code de vérification DataVision Tchad est : {otp_code}\n\n"
        f"Ce code est valide pendant 10 minutes. Ne le partagez jamais.\n\n"
        f"— INSEED Tchad"
    )

    html_body = _build_otp_html(username=username, otp_code=otp_code)

    # Attach plain first, HTML last (RFC 2046 — mail clients prefer the last part)
    msg.attach(MIMEText(plain_text, "plain", "utf-8"))
    msg.attach(MIMEText(html_body,  "html",  "utf-8"))

    try:
        server = smtplib.SMTP("smtp.gmail.com", 587)
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(smtp_user, smtp_pass)
        server.send_message(msg)
        server.quit()
        print(f"✅ HTML OTP email sent to {target_email}")
        return True
    except Exception as e:
        print(f"❌ SMTP Error: {e}")
        return False