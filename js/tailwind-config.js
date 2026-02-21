// Shared Tailwind config — single source of truth
// NOTE: Tailwind CDN is for development only. For production, use a build step.
window.tailwind && (tailwind.config = {
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                "primary": "#13ec5b",
                "background-light": "#f6f8f6",
                "background-dark": "#102216",
                "surface-dark": "#1c2e22",
                "surface-highlight": "#28392e",
                "text-main": "#e2e8e4",
                "text-muted": "#9db9a6",
                "gemini-blue": "#4aa9ff",
                "gemini-purple": "#8e44ad",
            },
            fontFamily: {
                "display": ["Manrope", "sans-serif"]
            },
            borderRadius: {
                "DEFAULT": "0.25rem",
                "lg": "0.5rem",
                "xl": "0.75rem",
                "2xl": "1rem",
                "3xl": "1.5rem",
                "full": "9999px"
            },
            backgroundImage: {
                "neon-gradient": "linear-gradient(135deg, #13ec5b 0%, #4aa9ff 50%, #8e44ad 100%)",
            },
        },
    },
});
