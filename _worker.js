addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request));
});

function parseJwt(token) {
  const base64Url = token.split('.')[1]; // 获取载荷部分
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
  const url = `https://${proxiedDomain}/api/auth/oauth_token`;
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

function isTokenExpired(token) {
  const payload = parseJwt(token);
  const currentTime = Math.floor(Date.now() / 1000); // 获取当前时间戳（秒）
  return payload.exp < currentTime; // 检查 token 是否过期
}

async function handleRequest(request) {
  const requestURL = new URL(request.url);

  // ------------ 反代到 new.oaifree.com
  const path = requestURL.pathname;
  if (path !== '/auth/login_auth0' && path !== '/auth/login') {
    requestURL.host = 'new.oaifree.com';
    return fetch(new Request(requestURL, request));
  }

  // ------------ 进行拿share_token去登录
  // @ts-ignore
  const token = await oai_global_variables.get('at'); // 这里填入你的 JWT
  if (token === '' || isTokenExpired(token)) {
    // 如果 Token 过期，执行获取新 Token 的逻辑
    const url = 'https://token.oaifree.com/api/auth/refresh';
    // @ts-ignore
    const refreshToken = await oai_global_variables.get('rt'); // 实际情况下你可能会从某处获取这个值

    // 发送 POST 请求
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: `refresh_token=${refreshToken}`,
    });

    // 检查响应状态
    if (response.ok) {
      const data = await response.json();
      const token = data.access_token;

      // @ts-ignore
      await oai_global_variables.put('at', token);
    } else {
      return new Response('Error fetching access token', {
        status: response.status,
      });
    }
  }

  // 如果 Token 未过期，继续执行原来的逻辑
  if (request.method === 'POST') {
    const formData = await request.formData();

    // @ts-ignore
    const SITE_PASSWORD = (await oai_global_variables.get('SITE_PASSWORD')) || '';
    const site_password = formData.get('site_password') || '';
    if (site_password !== SITE_PASSWORD) {
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

    // @ts-ignore
    const access_token = await oai_global_variables.get('at');
    const unique_name = formData.get('unique_name');
    const site_limit = '';
    const expires_in = '0';
    const gpt35_limit = '-1';
    const gpt4_limit = '-1';
    const show_conversations = 'false';
    const reset_limit = 'false';

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
    const tokenKey = 'token_key' in respJson ? respJson.token_key : '未找到 Share_token';

    // @ts-ignore
    const YOUR_DOMAIN = (await oai_global_variables.get('YOUR_DOMAIN')) || requestURL.host;

    return Response.redirect(await getOAuthLink(tokenKey, YOUR_DOMAIN), 302);
  } else {
    const formHtml = `
      <!DOCTYPE html>
      <html lang="en">

      <head>
        <title>Tpraise's ChatGPT</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body {
                display: flex;
                justify-content: center;
                align-items: center;
                height: 90vh;
                overflow: hidden;
            }
            h1{
                text-align: center;
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
      
            @media (max-width: 768px) {
                body,
                form,
                .response-container {
                    padding: 20px;
                }
            }
        </style>
      </head>

      <body>
        <div>
            <h1>ChatGPT</h1>
            <form method="POST">
                <div class="input-wrapper">
                    <input type="text" id="unique_name" name="unique_name" placeholder="你的专属名字，用于会话隔离" required value="">
                    <label for="unique_name">用户名</label>
                </div>
                <button type="submit">Continue</button>
            </form>
        </div>
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
