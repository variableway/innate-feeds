export const siteConfig = {
  name: "Awesome DSH Plugins",
  description: "A curated list of DeepSeek Harness (dsh) plugins",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  links: {
    awesomeList: "https://github.com/awesome-dsh-plugin/awesome-dsh-plugin",
    dsh: "https://github.com/deepseek-ai/deepseek-harness",
  },
} as const
