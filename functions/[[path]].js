export async function onRequest(context) {
  const { request, env } = context;

  async function handleRequest(request) {
    const requestURL = new URL(request.url);
    // ------------ 反代到 new.oaifree.com
    const path = requestURL.pathname;
    if (path !== '/auth/login_auth0' && path !== '/auth/login') {
      requestURL.host = 'new.oaifree.com';
      const response = await fetch(new Request(requestURL, request));
      //去掉小锁
      if (path === '/backend-api/conversations') {
        const data = await response.json();
        data.items = data.items.filter(item => item.title !== "🔒");
        return new Response(JSON.stringify(data), {
          status: response.status,
          headers: response.headers
        });
      }
      return response;
    }

    // ------------ 进行拿share_token去登录
    if (request.method === 'POST') {
      const formData = await request.formData();

      // @ts-ignore
      const SITE_PASSWORD = (await env.oai_global_variables.get('SITE_PASSWORD')) || '';
      const site_password = formData.get('site_password') || '';
      if (site_password !== SITE_PASSWORD) {
        return sitePasswordError();
      }
      // @ts-ignore
      const unique_name = formData.get('unique_name');
      const form_access_token = formData.get('access_token');
      const name_access_token = await env.oai_global_variables.get(unique_name);
      // access_token使用顺序：表单填写 -> KV变量 -> 共享
      const access_token = form_access_token || name_access_token || await env.oai_global_variables.get('at');
      const site_limit = '';
      const expires_in = '0';
      const gpt35_limit = '-1';
      const gpt4_limit = '-1';
      // 使用自己的access_token不开启会话隔离
      const show_conversations = (form_access_token || name_access_token) ? 'true' : 'false';
      const reset_limit = 'false';
      if (isTokenExpired(access_token)) {
        return new Response('access_token已过期，请更新', {
          status: 401,
        });
      }
      const url = 'https://chat.oaifree.com/token/register';
      const body = new URLSearchParams({
        unique_name,
        access_token, // 使用来自表单或KV变量的 access_token
        site_limit,
        expires_in,
        gpt35_limit,
        gpt4_limit,
        show_conversations,
        reset_limit,
      }).toString();

      const apiResponse = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body,
      });

      const respJson = await apiResponse.json();
      if(!'token_key' in respJson) {
        return new Response('access_token无效', {
          status: 401,
        });
      }
      // 如果表单填写access_token，更新该用户名的access_token
      form_access_token && (await env.oai_global_variables.put(unique_name, form_access_token));

      // @ts-ignore
      const YOUR_DOMAIN = (await env.oai_global_variables.get('YOUR_DOMAIN')) || requestURL.host;

      return Response.redirect(await getOAuthLink(respJson.token_key, YOUR_DOMAIN), 302);
    } else {
      const SITE_PASSWORD = await env.oai_global_variables.get('SITE_PASSWORD');
      const formHtml = `
        <!DOCTYPE html>
        <html lang="en">
  
        <head>
          <title>Tpraise's ChatGPT</title>
          <link rel="icon" href="data:image/svg+xml,<svg width='32' height='32' viewBox='0 0 41 41' fill='none' xmlns='http://www.w3.org/2000/svg'><path d='M37.5324 16.8707C37.9808 15.5241 38.1363 14.0974 37.9886 12.6859C37.8409 11.2744 37.3934 9.91076 36.676 8.68622C35.6126 6.83404 33.9882 5.3676 32.0373 4.4985C30.0864 3.62941 27.9098 3.40259 25.8215 3.85078C24.8796 2.7893 23.7219 1.94125 22.4257 1.36341C21.1295 0.785575 19.7249 0.491269 18.3058 0.500197C16.1708 0.495044 14.0893 1.16803 12.3614 2.42214C10.6335 3.67624 9.34853 5.44666 8.6917 7.47815C7.30085 7.76286 5.98686 8.3414 4.8377 9.17505C3.68854 10.0087 2.73073 11.0782 2.02839 12.312C0.956464 14.1591 0.498905 16.2988 0.721698 18.4228C0.944492 20.5467 1.83612 22.5449 3.268 24.1293C2.81966 25.4759 2.66413 26.9026 2.81182 28.3141C2.95951 29.7256 3.40701 31.0892 4.12437 32.3138C5.18791 34.1659 6.8123 35.6322 8.76321 36.5013C10.7141 37.3704 12.8907 37.5973 14.9789 37.1492C15.9208 38.2107 17.0786 39.0587 18.3747 39.6366C19.6709 40.2144 21.0755 40.5087 22.4946 40.4998C24.6307 40.5054 26.7133 39.8321 28.4418 38.5772C30.1704 37.3223 31.4556 35.5506 32.1119 33.5179C33.5027 33.2332 34.8167 32.6547 35.9659 31.821C37.115 30.9874 38.0728 29.9178 38.7752 28.684C39.8458 26.8371 40.3023 24.6979 40.0789 22.5748C39.8556 20.4517 38.9639 18.4544 37.5324 16.8707ZM22.4978 37.8849C20.7443 37.8874 19.0459 37.2733 17.6994 36.1501C17.7601 36.117 17.8666 36.0586 17.936 36.0161L25.9004 31.4156C26.1003 31.3019 26.2663 31.137 26.3813 30.9378C26.4964 30.7386 26.5563 30.5124 26.5549 30.2825V19.0542L29.9213 20.998C29.9389 21.0068 29.9541 21.0198 29.9656 21.0359C29.977 21.052 29.9842 21.0707 29.9867 21.0902V30.3889C29.9842 32.375 29.1946 34.2791 27.7909 35.6841C26.3872 37.0892 24.4838 37.8806 22.4978 37.8849ZM6.39227 31.0064C5.51397 29.4888 5.19742 27.7107 5.49804 25.9832C5.55718 26.0187 5.66048 26.0818 5.73461 26.1244L13.699 30.7248C13.8975 30.8408 14.1233 30.902 14.3532 30.902C14.583 30.902 14.8088 30.8408 15.0073 30.7248L24.731 25.1103V28.9979C24.7321 29.0177 24.7283 29.0376 24.7199 29.0556C24.7115 29.0736 24.6988 29.0893 24.6829 29.1012L16.6317 33.7497C14.9096 34.7416 12.8643 35.0097 10.9447 34.4954C9.02506 33.9811 7.38785 32.7263 6.39227 31.0064ZM4.29707 13.6194C5.17156 12.0998 6.55279 10.9364 8.19885 10.3327C8.19885 10.4013 8.19491 10.5228 8.19491 10.6071V19.808C8.19351 20.0378 8.25334 20.2638 8.36823 20.4629C8.48312 20.6619 8.64893 20.8267 8.84863 20.9404L18.5723 26.5542L15.206 28.4979C15.1894 28.5089 15.1703 28.5155 15.1505 28.5173C15.1307 28.5191 15.1107 28.516 15.0924 28.5082L7.04046 23.8557C5.32135 22.8601 4.06716 21.2235 3.55289 19.3046C3.03862 17.3858 3.30624 15.3413 4.29707 13.6194ZM31.955 20.0556L22.2312 14.4411L25.5976 12.4981C25.6142 12.4872 25.6333 12.4805 25.6531 12.4787C25.6729 12.4769 25.6928 12.4801 25.7111 12.4879L33.7631 17.1364C34.9967 17.849 36.0017 18.8982 36.6606 20.1613C37.3194 21.4244 37.6047 22.849 37.4832 24.2684C37.3617 25.6878 36.8382 27.0432 35.9743 28.1759C35.1103 29.3086 33.9415 30.1717 32.6047 30.6641C32.6047 30.5947 32.6047 30.4733 32.6047 30.3889V21.188C32.6066 20.9586 32.5474 20.7328 32.4332 20.5338C32.319 20.3348 32.154 20.1698 31.955 20.0556ZM35.3055 15.0128C35.2464 14.9765 35.1431 14.9142 35.069 14.8717L27.1045 10.2712C26.906 10.1554 26.6803 10.0943 26.4504 10.0943C26.2206 10.0943 25.9948 10.1554 25.7963 10.2712L16.0726 15.8858V11.9982C16.0715 11.9783 16.0753 11.9585 16.0837 11.9405C16.0921 11.9225 16.1048 11.9068 16.1207 11.8949L24.1719 7.25025C25.4053 6.53903 26.8158 6.19376 28.2383 6.25482C29.6608 6.31589 31.0364 6.78077 32.2044 7.59508C33.3723 8.40939 34.2842 9.53945 34.8334 10.8531C35.3826 12.1667 35.5464 13.6095 35.3055 15.0128ZM14.2424 21.9419L10.8752 19.9981C10.8576 19.9893 10.8423 19.9763 10.8309 19.9602C10.8195 19.9441 10.8122 19.9254 10.8098 19.9058V10.6071C10.8107 9.18295 11.2173 7.78848 11.9819 6.58696C12.7466 5.38544 13.8377 4.42659 15.1275 3.82264C16.4173 3.21869 17.8524 2.99464 19.2649 3.1767C20.6775 3.35876 22.0089 3.93941 23.1034 4.85067C23.0427 4.88379 22.937 4.94215 22.8668 4.98473L14.9024 9.58517C14.7025 9.69878 14.5366 9.86356 14.4215 10.0626C14.3065 10.2616 14.2466 10.4877 14.2479 10.7175L14.2424 21.9419ZM16.071 17.9991L20.4018 15.4978L24.7325 17.9975V22.9985L20.4018 25.4983L16.071 22.9985V17.9991Z' fill='currentColor'/></svg>">
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
              body {
                  display: flex;
                  justify-content: center;
                  height: 90vh;
                  overflow: hidden;
              }
              svg {
                padding-top: 32px;
              }
              h1 {
                  text-align: center;
                  padding-top: 120px;
              }
              input{
                      appearance: none;
                      -webkit-appearance: none;
                      -moz-appearance: none;
                      outline: none;
                  }
              .input-wrapper {
                  position: relative;
                  margin-bottom: 20px;
              }
              .input-wrapper label {
                  position: absolute;
                  left: 10px;
                  top: 14px;
                  transition: 0.3s;
                  color: #ccc;
                  background-color: #ffffff;
              }
              .input-wrapper input {
                  width: 274px;
                  height: 52px;
                  padding: 0 10px;
                  border-radius: 5px;
                  border: 1px solid #ccc;
                  display: block;
                  font-size: 16px;
              }
              .input-wrapper input:not(:placeholder-shown) {
                  border-color: #0f9977 !important;
              }
              .input-wrapper input:focus {
                  border-color: #0f9977 !important;
              }
              .input-wrapper input:focus + label,
              .input-wrapper input:not(:placeholder-shown) + label {
                  top: -10px;
                  left: 10px;
                  font-size: 16px;
                  color: #0f9977;
              }
              button {
                  background-color: #0f9977;
                  color: #ffffff;
                  padding: 10px 20px;
                  border: none;
                  border-radius: 5px;
                  cursor: pointer;
                  font-size: 16px;
                  font-weight: 600;
                  width: 295px !important;
                  height: 52px;
              }
              .other-page {
                  text-align: center;
                  margin-top: 16px;
                  margin-bottom: 0;
                  font-size: 14px;
              }
              @media (max-width: 768px) {
                  body,
                  form,
                  .response-container {
                      padding: 20px;
                  }
                  h1 {
                      text-align: center;
                      padding-top: 40px;
                  }
              }
          </style>
        </head>

        <body>
          <div style="text-align: center;">
              <svg width="32" height="32" viewBox="0 0 41 41" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M37.5324 16.8707C37.9808 15.5241 38.1363 14.0974 37.9886 12.6859C37.8409 11.2744 37.3934 9.91076 36.676 8.68622C35.6126 6.83404 33.9882 5.3676 32.0373 4.4985C30.0864 3.62941 27.9098 3.40259 25.8215 3.85078C24.8796 2.7893 23.7219 1.94125 22.4257 1.36341C21.1295 0.785575 19.7249 0.491269 18.3058 0.500197C16.1708 0.495044 14.0893 1.16803 12.3614 2.42214C10.6335 3.67624 9.34853 5.44666 8.6917 7.47815C7.30085 7.76286 5.98686 8.3414 4.8377 9.17505C3.68854 10.0087 2.73073 11.0782 2.02839 12.312C0.956464 14.1591 0.498905 16.2988 0.721698 18.4228C0.944492 20.5467 1.83612 22.5449 3.268 24.1293C2.81966 25.4759 2.66413 26.9026 2.81182 28.3141C2.95951 29.7256 3.40701 31.0892 4.12437 32.3138C5.18791 34.1659 6.8123 35.6322 8.76321 36.5013C10.7141 37.3704 12.8907 37.5973 14.9789 37.1492C15.9208 38.2107 17.0786 39.0587 18.3747 39.6366C19.6709 40.2144 21.0755 40.5087 22.4946 40.4998C24.6307 40.5054 26.7133 39.8321 28.4418 38.5772C30.1704 37.3223 31.4556 35.5506 32.1119 33.5179C33.5027 33.2332 34.8167 32.6547 35.9659 31.821C37.115 30.9874 38.0728 29.9178 38.7752 28.684C39.8458 26.8371 40.3023 24.6979 40.0789 22.5748C39.8556 20.4517 38.9639 18.4544 37.5324 16.8707ZM22.4978 37.8849C20.7443 37.8874 19.0459 37.2733 17.6994 36.1501C17.7601 36.117 17.8666 36.0586 17.936 36.0161L25.9004 31.4156C26.1003 31.3019 26.2663 31.137 26.3813 30.9378C26.4964 30.7386 26.5563 30.5124 26.5549 30.2825V19.0542L29.9213 20.998C29.9389 21.0068 29.9541 21.0198 29.9656 21.0359C29.977 21.052 29.9842 21.0707 29.9867 21.0902V30.3889C29.9842 32.375 29.1946 34.2791 27.7909 35.6841C26.3872 37.0892 24.4838 37.8806 22.4978 37.8849ZM6.39227 31.0064C5.51397 29.4888 5.19742 27.7107 5.49804 25.9832C5.55718 26.0187 5.66048 26.0818 5.73461 26.1244L13.699 30.7248C13.8975 30.8408 14.1233 30.902 14.3532 30.902C14.583 30.902 14.8088 30.8408 15.0073 30.7248L24.731 25.1103V28.9979C24.7321 29.0177 24.7283 29.0376 24.7199 29.0556C24.7115 29.0736 24.6988 29.0893 24.6829 29.1012L16.6317 33.7497C14.9096 34.7416 12.8643 35.0097 10.9447 34.4954C9.02506 33.9811 7.38785 32.7263 6.39227 31.0064ZM4.29707 13.6194C5.17156 12.0998 6.55279 10.9364 8.19885 10.3327C8.19885 10.4013 8.19491 10.5228 8.19491 10.6071V19.808C8.19351 20.0378 8.25334 20.2638 8.36823 20.4629C8.48312 20.6619 8.64893 20.8267 8.84863 20.9404L18.5723 26.5542L15.206 28.4979C15.1894 28.5089 15.1703 28.5155 15.1505 28.5173C15.1307 28.5191 15.1107 28.516 15.0924 28.5082L7.04046 23.8557C5.32135 22.8601 4.06716 21.2235 3.55289 19.3046C3.03862 17.3858 3.30624 15.3413 4.29707 13.6194ZM31.955 20.0556L22.2312 14.4411L25.5976 12.4981C25.6142 12.4872 25.6333 12.4805 25.6531 12.4787C25.6729 12.4769 25.6928 12.4801 25.7111 12.4879L33.7631 17.1364C34.9967 17.849 36.0017 18.8982 36.6606 20.1613C37.3194 21.4244 37.6047 22.849 37.4832 24.2684C37.3617 25.6878 36.8382 27.0432 35.9743 28.1759C35.1103 29.3086 33.9415 30.1717 32.6047 30.6641C32.6047 30.5947 32.6047 30.4733 32.6047 30.3889V21.188C32.6066 20.9586 32.5474 20.7328 32.4332 20.5338C32.319 20.3348 32.154 20.1698 31.955 20.0556ZM35.3055 15.0128C35.2464 14.9765 35.1431 14.9142 35.069 14.8717L27.1045 10.2712C26.906 10.1554 26.6803 10.0943 26.4504 10.0943C26.2206 10.0943 25.9948 10.1554 25.7963 10.2712L16.0726 15.8858V11.9982C16.0715 11.9783 16.0753 11.9585 16.0837 11.9405C16.0921 11.9225 16.1048 11.9068 16.1207 11.8949L24.1719 7.25025C25.4053 6.53903 26.8158 6.19376 28.2383 6.25482C29.6608 6.31589 31.0364 6.78077 32.2044 7.59508C33.3723 8.40939 34.2842 9.53945 34.8334 10.8531C35.3826 12.1667 35.5464 13.6095 35.3055 15.0128ZM14.2424 21.9419L10.8752 19.9981C10.8576 19.9893 10.8423 19.9763 10.8309 19.9602C10.8195 19.9441 10.8122 19.9254 10.8098 19.9058V10.6071C10.8107 9.18295 11.2173 7.78848 11.9819 6.58696C12.7466 5.38544 13.8377 4.42659 15.1275 3.82264C16.4173 3.21869 17.8524 2.99464 19.2649 3.1767C20.6775 3.35876 22.0089 3.93941 23.1034 4.85067C23.0427 4.88379 22.937 4.94215 22.8668 4.98473L14.9024 9.58517C14.7025 9.69878 14.5366 9.86356 14.4215 10.0626C14.3065 10.2616 14.2466 10.4877 14.2479 10.7175L14.2424 21.9419ZM16.071 17.9991L20.4018 15.4978L24.7325 17.9975V22.9985L20.4018 25.4983L16.071 22.9985V17.9991Z" fill="currentColor"/>
              </svg>
              <h1>欢迎回来</h1>
              <form method="POST">
                  <div class="input-wrapper">
                      <input type="text" id="unique_name" name="unique_name" placeholder=" " required value="">
                      <label for="unique_name">用户名</label>
                  </div>
                  <div class="input-wrapper" ${SITE_PASSWORD ? '' : 'style="display: none;"'} >
                      <input type="password" id="site_password" name="site_password" placeholder=" ">
                      <label for="site_password">本站密码</label>
                  </div>
                  <div class="input-wrapper" id="access_token_wrapper" style="display: none;">
                      <input id="access_token" name="access_token" placeholder=" ">
                      <label for="access_token">accessToken（可选）</label>
                  </div>
                  <button type="submit">继续</button>
                  <p class="other-page">使用自己的 <a class="other-page-link" href="javascript:void(0);" onclick="toggleAccessToken()">accessToken</a></p>
              </form>
          </div>
          <script>
            function toggleAccessToken() {
              var accessTokenWrapper = document.getElementById('access_token_wrapper');
              if (accessTokenWrapper.style.display === 'none' || accessTokenWrapper.style.display === '') {
                  accessTokenWrapper.style.display = 'block';
              } else {
                  accessTokenWrapper.style.display = 'none';
              }
            }
          </script>
        </body>

        </html>
      `;

      return new Response(formHtml, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    }
  }

  function isTokenExpired(token) {
    try {
      const payload = parseJwt(token);
      const currentTime = Math.floor(Date.now() / 1000); // 获取当前时间戳（秒）
      return payload.exp < currentTime; // 检查 token 是否过期
    } catch (error) {
      console.error("Failed to parse token:", error.message);
      return true; // 如果解析失败，返回 true
    }
  }

  function parseJwt(token) {
    const base64Url = token?.split('.')[1]; // 获取载荷部分
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/'); // 将 Base64Url 转为 Base64
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(function (c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join('')
    );
    return JSON.parse(jsonPayload); // 返回载荷解析后的 JSON 对象
  }

  async function getOAuthLink(shareToken, proxiedDomain) {
    const url = `https://new.oaifree.com/api/auth/oauth_token`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Origin: `https://${proxiedDomain}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        share_token: shareToken,
      }),
    });
    const data = await response.json();
    return data.login_url;
  }

  function sitePasswordError() {
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Incorrect</title>
      </head>
      <body>
        <script>
          alert("访问密码错误");
          // 可以添加其他逻辑或重定向
          window.history.back();
        </script>
      </body>
      </html>
    `;
    return new Response(htmlContent, {
      status: 401,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  return handleRequest(request);
}
