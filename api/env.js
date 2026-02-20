export default function handler(req, res) {
    // Return the Supabase URL and Anon Key injected by Vercel
    res.status(200).json({
        supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    });
}
