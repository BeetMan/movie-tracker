// 静态资产部署在子路径下时，资产键是根相对的，
// 这个脚本把请求路径的子路径前缀剥掉再转交 ASSETS。
// 前缀通过 wrangler.toml 的 [vars] BASE_PATH 配置（如 "/movie"），不写死。
export default {
  fetch(request, env) {
    const url = new URL(request.url)
    const base = env.BASE_PATH || '/movie'
    // /movie → 301 到 /movie/，规范 URL（相对路径资产、路由匹配都依赖它）
    if (url.pathname === base) {
      return Response.redirect(url.origin + base + '/' + url.search, 301)
    }
    if (url.pathname.startsWith(base + '/')) {
      url.pathname = url.pathname.slice(base.length)
    }
    return env.ASSETS.fetch(new Request(url.toString(), request))
  },
}
