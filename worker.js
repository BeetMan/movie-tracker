// 静态资产部署在子路径下时，资产键是根相对的，
// 这个脚本把请求路径的子路径前缀剥掉再转交 ASSETS。
// 前缀通过 wrangler.toml 的 [vars] BASE_PATH 配置（如 "/movie"），不写死。
export default {
  fetch(request, env) {
    const url = new URL(request.url)
    const base = env.BASE_PATH || '/movie'
    if (url.pathname === base) {
      url.pathname = '/'
    } else if (url.pathname.startsWith(base + '/')) {
      url.pathname = url.pathname.slice(base.length)
    }
    return env.ASSETS.fetch(new Request(url.toString(), request))
  },
}
