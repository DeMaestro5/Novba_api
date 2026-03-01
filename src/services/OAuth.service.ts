import axios from 'axios';

export interface OAuthProfile {
  providerId: string; // Google sub / GitHub id (as string)
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  profilePicUrl?: string;
  provider: 'google' | 'github';
}

// ── GOOGLE ────────────────────────────────────────────────────────────────────

export async function exchangeGoogleCode(code: string): Promise<OAuthProfile> {
  // Step 1: Exchange authorization code for access token (Google expects form-urlencoded)
  const tokenBody = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    redirect_uri: `${process.env.SERVER_URL}/auth/oauth/google/callback`,
    grant_type: 'authorization_code',
  });

  const tokenRes = await axios.post<{
    access_token: string;
    token_type: string;
  }>('https://oauth2.googleapis.com/token', tokenBody.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  const accessToken = tokenRes.data.access_token;

  // Step 2: Fetch user profile from Google
  const profileRes = await axios.get<{
    sub: string;
    email: string;
    name: string;
    given_name: string;
    family_name: string;
    picture: string;
    email_verified: boolean;
  }>('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const profile = profileRes.data;

  if (!profile.email_verified) {
    throw new Error('Google account email is not verified');
  }

  return {
    providerId: profile.sub,
    email: profile.email.toLowerCase(),
    name: profile.name,
    firstName: profile.given_name,
    lastName: profile.family_name,
    profilePicUrl: profile.picture,
    provider: 'google',
  };
}

// ── GITHUB ────────────────────────────────────────────────────────────────────

export async function exchangeGitHubCode(code: string): Promise<OAuthProfile> {
  // Step 1: Exchange code for access token (GitHub expects form-urlencoded)
  const tokenBody = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID!,
    client_secret: process.env.GITHUB_CLIENT_SECRET!,
    code,
    redirect_uri: `${process.env.SERVER_URL}/auth/oauth/github/callback`,
  });

  const tokenRes = await axios.post<{ access_token: string }>(
    'https://github.com/login/oauth/access_token',
    tokenBody.toString(),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
    },
  );

  const accessToken = tokenRes.data.access_token;

  // Step 2: Fetch user profile
  const profileRes = await axios.get<{
    id: number;
    login: string;
    name: string | null;
    email: string | null;
    avatar_url: string;
  }>('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
    },
  });

  const profile = profileRes.data;

  // Step 3: GitHub email can be null if private — fetch from emails endpoint
  let email = profile.email;
  if (!email) {
    const emailsRes = await axios.get<
      Array<{ email: string; primary: boolean; verified: boolean }>
    >('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
      },
    });
    const primary = emailsRes.data.find((e) => e.primary && e.verified);
    if (!primary) throw new Error('No verified email found on GitHub account');
    email = primary.email;
  }

  // Parse name into first/last
  const nameParts = (profile.name || profile.login).split(' ');
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(' ') || undefined;

  return {
    providerId: String(profile.id),
    email: email.toLowerCase(),
    name: profile.name || profile.login,
    firstName,
    lastName,
    profilePicUrl: profile.avatar_url,
    provider: 'github',
  };
}
