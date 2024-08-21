export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    url.host = 'new.oaifree.com';
    return fetch(new Request(url, request))
  }
}
