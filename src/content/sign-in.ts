// Sign-in / register modal, the signed-in header menu and the reset-password
// page. Error messages returned by the server are in ./auth.ts. Keep
// user-facing text here so Hindi can be added later.

export const signIn = {
  eyebrow: "My profile",
  title: "One profile. Your complete Saatvik journey.",
  description:
    "Sign in with your mobile number or email to save products, track orders, access courses and earn Saatvik Coins.",
  tabs: {
    label: "Sign in with",
    mobile: "Mobile",
    email: "Email",
  },
  phone: {
    label: "Mobile number",
    placeholder: "Enter 10-digit number",
    submit: "Continue with OTP",
  },
  otp: {
    heading: "Enter your code",
    sentTo: (phone: string) => `We sent a 6-digit code by SMS to ${phone}.`,
    changeNumber: "Change number",
    label: "6-digit code",
    incomplete: "Enter all 6 digits of the code.",
    submit: "Verify and continue",
    resend: "Resend code",
    resendIn: (seconds: number) =>
      `Resend code in 0:${String(seconds).padStart(2, "0")}`,
    resent: "We sent a new code.",
  },
  devOtp: {
    label: "Dev only",
    code: "Latest code",
    waiting: "Waiting for the code…",
    note: "Shown because DEV_SHOW_OTP=true. Never shown in production.",
  },
  register: {
    heading: "Tell us about yourself",
    lead: "New here? A few details and your profile is ready.",
    name: "Full name",
    namePlaceholder: "Your name",
    nameError: "Enter your name (at least 2 letters).",
    userType: "I am a",
    userTypeError: "Choose who you are.",
    professionalNote:
      "Professional prices unlock after our team verifies your documents. Until then you'll see retail prices.",
    termsLead: "I agree to the",
    termsLink: "Terms",
    termsJoin: "and the",
    privacyLink: "Privacy Policy",
    newTab: "(opens in a new tab)",
    termsError: "Please accept the terms to continue.",
    marketing:
      "Send me offers, new launches and learning updates. You can stop these any time.",
    submitPhone: "Create my profile",
    unavailable:
      "Sign-up isn't available right now. Please try again in a few minutes.",
  },
  email: {
    signInHeading: "Sign in with email",
    registerHeading: "Create your account",
    forgotHeading: "Reset your password",
    email: "Email",
    emailPlaceholder: "you@example.com",
    password: "Password",
    newPassword: "Choose a password",
    passwordRequired: "Enter your password.",
    forgot: "Forgot password?",
    submit: "Sign in",
    toRegister: "New to Saatvik Vaidya?",
    toRegisterLink: "Create an account",
    registerSubmit: "Create account",
    toSignIn: "Already have an account?",
    toSignInLink: "Sign in",
    forgotLead:
      "Enter the email you signed up with and we'll send you a link to choose a new password.",
    forgotSubmit: "Send reset link",
    forgotSent: (email: string) =>
      `If an account uses ${email}, we've sent it a link to reset the password. The link works for 60 minutes.`,
    backToSignIn: "Back to sign in",
  },
  privacyNote:
    "By continuing, you agree to our Terms and Privacy Policy. Marketing messages are optional.",
  welcome: (name: string) => `Welcome, ${name}`,
  welcomeBack: "You're signed in.",
  registered: "Your profile is ready.",
  errors: {
    generic: "Something went wrong. Please try again.",
    network:
      "We couldn't reach the server. Check your connection and try again.",
    retryIn: (minutes: number) =>
      `You can try again in about ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`,
  },
  menu: {
    trigger: (name: string) => `Account menu, ${name}`,
    subtitle: "My account",
    account: "My account",
    orders: "My orders",
    signOut: "Sign out",
    signingOut: "Signing out…",
    signedOut: "You're signed out.",
  },
  resetPage: {
    title: "Choose a new password",
    eyebrow: "Account",
    lead: "Pick a password you don't use anywhere else. Signing in again on your other devices will be needed afterwards.",
    submit: "Save new password",
    done: "Your password has been changed.",
    doneLead: "Sign in with your new password to continue.",
    signIn: "Sign in",
    invalid: "This reset link has expired or was already used.",
    invalidLead: "Ask for a new link from the sign-in window.",
    requestNew: "Get a new link",
  },
} as const;
