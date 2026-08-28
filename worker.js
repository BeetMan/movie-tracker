// 静态资产-only 部署在子路径 /movie 下时，资产键是根相对的，
// 需要这个小脚本把请求路径的 /movie 前缀剥掉再转交 ASSETS。
export default {
  fetch(request, env) {
    const url = new URL(request.url)
    url.pathname = url.pathname.replace(/^\/movie(?=\/|$)/, '') || '/'
    return env.ASSETS.fetch(new Request(url.toString(), request))
  },
}
