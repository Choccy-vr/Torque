
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL || 'http://127.0.0.1:54321',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-local-service-role-key',
    { auth: { autoRefreshToken: false, persistSession: false } }
);

async function setup() {
    const { data, error } = await supabase.auth.admin.customProviders.createProvider({
        provider_type: 'oidc',
        identifier: 'custom:hackclub-auth',
        name: 'HCA OIDC Provider',
        client_id: process.env.OIDC_CLIENT_ID,
        client_secret: process.env.OIDC_CLIENT_SECRET,
        issuer: 'https://auth.hackclub.com',
        scopes: ['openid', 'profile', 'email', 'name', 'slack_id', 'verification_status'],
    })



    if (error) console.log('OIDC provider setup:', error.message);
    else console.log('OIDC provider configured successfully.');
}

async function check() {
    const { data, error } = await supabase.auth.admin.customProviders.listProviders();
    if (error) {
        console.error('Error fetching providers:', error);
    } else {
        console.log('Registered Custom Providers:', JSON.stringify(data, null, 2));
    }
}

setup();
check();