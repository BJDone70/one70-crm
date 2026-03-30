import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_EMAIL = process.env.FROM_EMAIL || 'ONE70 CRM <onboarding@resend.dev>'

export async function sendInviteEmail({
  to,
  inviterName,
  role,
  inviteUrl,
}: {
  to: string
  inviterName: string
  role: string
  inviteUrl: string
}) {
  const roleLabel = role === 'admin' ? 'Admin' : role === 'rep' ? 'Sales Rep' : 'Viewer'

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `You're invited to ONE70 Group CRM`,
    html: `
      <div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 0;">
        <div style="background-color: #1A1A1A; padding: 32px; text-align: center;">
          <h1 style="color: #FFFFFF; font-size: 28px; margin: 0; font-weight: 900; letter-spacing: -0.5px;">
            ONE<span style="color: #FFE500;">70</span>
          </h1>
          <div style="width: 48px; height: 3px; background-color: #FFE500; margin: 8px auto 0;"></div>
          <p style="color: #666666; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin-top: 8px;">Group CRM</p>
        </div>
        <div style="padding: 40px 32px; background-color: #FFFFFF;">
          <h2 style="color: #1A1A1A; font-size: 20px; margin: 0 0 16px;">You've been invited</h2>
          <p style="color: #333333; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
            ${inviterName} has invited you to join <strong>ONE70 Group CRM</strong> as a <strong>${roleLabel}</strong>.
          </p>
          <p style="color: #333333; font-size: 15px; line-height: 1.6; margin: 0 0 32px;">
            Click the button below to create your account. This link expires in 72 hours.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${inviteUrl}" style="display: inline-block; background-color: #1A1A1A; color: #FFFFFF; padding: 14px 32px; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 6px;">
              Accept Invitation
            </a>
          </div>
          <p style="color: #999999; font-size: 12px; line-height: 1.5; margin-top: 32px;">
            If the button doesn't work, copy and paste this URL into your browser:<br/>
            <span style="color: #666666; word-break: break-all;">${inviteUrl}</span>
          </p>
        </div>
        <div style="background-color: #F5F5F5; padding: 24px 32px; text-align: center; border-top: 3px solid #FFE500;">
          <p style="color: #999999; font-size: 12px; margin: 0;">
            Clear Cost. Clear Schedule. Ability to Scale.
          </p>
          <p style="color: #CCCCCC; font-size: 11px; margin: 8px 0 0;">
            one70group.com
          </p>
        </div>
      </div>
    `,
  })

  if (error) {
    console.error('Failed to send invite email:', error)
    throw new Error(error.message)
  }

  return data
}

export async function sendWelcomeEmail({
  to,
  name,
  loginUrl,
}: {
  to: string
  name: string
  loginUrl: string
}) {
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `Welcome to ONE70 Group CRM`,
    html: `
      <div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 0;">
        <div style="background-color: #1A1A1A; padding: 32px; text-align: center;">
          <h1 style="color: #FFFFFF; font-size: 28px; margin: 0; font-weight: 900; letter-spacing: -0.5px;">
            ONE<span style="color: #FFE500;">70</span>
          </h1>
          <div style="width: 48px; height: 3px; background-color: #FFE500; margin: 8px auto 0;"></div>
          <p style="color: #666666; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin-top: 8px;">Group CRM</p>
        </div>
        <div style="padding: 40px 32px; background-color: #FFFFFF;">
          <h2 style="color: #1A1A1A; font-size: 20px; margin: 0 0 16px;">Welcome, ${name}!</h2>
          <p style="color: #333333; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
            Your account has been created. You can now sign in to the ONE70 Group CRM.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${loginUrl}" style="display: inline-block; background-color: #1A1A1A; color: #FFFFFF; padding: 14px 32px; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 6px;">
              Sign In
            </a>
          </div>
        </div>
        <div style="background-color: #F5F5F5; padding: 24px 32px; text-align: center; border-top: 3px solid #FFE500;">
          <p style="color: #999999; font-size: 12px; margin: 0;">
            Clear Cost. Clear Schedule. Ability to Scale.
          </p>
          <p style="color: #CCCCCC; font-size: 11px; margin: 8px 0 0;">
            one70group.com
          </p>
        </div>
      </div>
    `,
  })

  if (error) {
    console.error('Failed to send welcome email:', error)
    throw new Error(error.message)
  }

  return data
}
