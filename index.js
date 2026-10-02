export default {
    async fetch(request, env, ctx) {
        const { searchParams } = new URL(request.url);
        // Access key: set with `wrangler secret put ACCESS_KEY`; requests must carry ?key=...
        if (env.ACCESS_KEY && searchParams.get("key") !== env.ACCESS_KEY) {
            return new Response("Forbidden", { status: 403 });
        }
        const targetUrl = searchParams.get("url");

        if (!targetUrl) {
            return new Response("❌ Missing ?url= parameter", { status: 400 });
        }

        try {
            // Config: host-specific headers
            const rules = {
                "example.com": {
                    Origin: "https://example.com",
                    Referer: "https://example.com/",
                },
            };

            // Always add a UA
            let customHeaders = {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
            };


            // Check if host matches rules
            const host = new URL(targetUrl).hostname;
            for (const ruleHost in rules) {
                if (host.includes(ruleHost)) {
                    Object.assign(customHeaders, rules[ruleHost]);
                    break;
                }
            }

            // Fetch with headers
            const resp = await fetch(targetUrl, { headers: customHeaders });
            if (!resp.ok) {
                return new Response(
                    `Failed to fetch: ${resp.status} ${resp.statusText}`,
                    { status: resp.status }
                );
            }

            let text = await resp.text();
            const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf("/") + 1);

            // Rewrite relative links into absolute and escape spaces
            const rewritten = text
                .split("\n")
                .map((line) => {
                    line = line.trim();
                    if (!line || line.startsWith("#")) return line;
                    if (line.startsWith("http://") || line.startsWith("https://"))
                        return line;

                    // ensure spaces & special chars are escaped
                    return encodeURI(baseUrl + line);
                })
                .join("\n");

            return new Response(rewritten, {
                status: 200,
                headers: {
                    "Content-Type": "application/vnd.apple.mpegurl",
                    "Cache-Control": "no-store",
                },
            });
        } catch (err) {
            return new Response("Worker error: " + err.message, { status: 500 });
        }
    },
};