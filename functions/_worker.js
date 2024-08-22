export async function onRequest(context) {
  const { request } = context;
  return handleRequest(request);
}
function parseJwt(token) {
  const base64Url = token.split('.')[1]; // 获取载荷部分
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/'); // 将 Base64Url 转为 Base64
  const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));

  return JSON.parse(jsonPayload); // 返回载荷解析后的 JSON 对象
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
    return fetch(new Request(requestURL, request))
  }

  // ------------ 进行拿share_token去登录
  // @ts-ignore
  const token = await oai_global_variables.get('at'); // 这里填入你的 JWT
  if (isTokenExpired(token)) {
    // 如果 Token 过期，执行获取新 Token 的逻辑
    const url = 'https://token.oaifree.com/api/auth/refresh';
    // @ts-ignore
    const refreshToken = await oai_global_variables.get('rt');  // 实际情况下你可能会从某处获取这个值
  
    // 发送 POST 请求
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
        },
        body: `refresh_token=${refreshToken}`
    });
  
    // 检查响应状态
    if (response.ok) {
        const data = await response.json();
        const token = data.access_token;

        // @ts-ignore
        await oai_global_variables.put('at', token);
    } else {
        return new Response('Error fetching access token', { status: response.status });
    }
  }

  // 如果 Token 未过期，继续执行原来的逻辑
  if (request.method === "POST") {
    const formData = await request.formData();    

    // @ts-ignore
    const SITE_PASSWORD = await oai_global_variables.get('SITE_PASSWORD') || '';
    const site_password = formData.get('site_password') || '';
    if (site_password !== SITE_PASSWORD) {
      return new Response('站密码错误', { status: 401 }); //如果你不需要密码访问，注释此行代码
    }

    // @ts-ignore
    const access_token = await oai_global_variables.get('at')
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
      reset_limit
    }).toString();

    const apiResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body
    });

    const respJson = await apiResponse.json();
    const tokenKey = 'token_key' in respJson ? respJson.token_key : '未找到 Share_token';

    // @ts-ignore
    const YOUR_DOMAIN = await oai_global_variables.get('YOUR_DOMAIN') || requestURL.host;

    return Response.redirect(`https://${YOUR_DOMAIN}/auth/login_share?token=${tokenKey}`, 301)
  } else {
    const formHtml = `
        <!DOCTYPE html>
    <html lang="en">
    <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body {
        font-family: Arial, sans-serif;
        background-color: #f4f4f4;
        padding: 20px;
      }
      form, .response-container {
        background: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        max-width: 600px;
        margin: 20px auto;
      }
      h1 {
        text-align: center; 
      }
      h2 {
        text-align: center; 
      }
      p {
        display: block;
        margin-bottom: 10px;
        font-size: 16px;
      }
      input[type="text"], textarea {
        width: calc(100% - 22px);
        padding: 10px;
        margin-top: 5px;
        margin-bottom: 20px;
        border-radius: 5px;
        border: 1px solid #ccc;
      }
      textarea {
        font-family: 'Courier New', monospace;
        background-color: #f8f8f8;
        height: 150px; /* Adjust height based on your needs */
      }
      button {
        background-color: #000000;
        color: white;
        padding: 10px 20px;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-size: 16px;
        font-weight:600;
        width:100% !important
      }
      button:hover {
        background-color: #1e293b;
      }
      @media (max-width: 768px) {
        body, form, .response-container {
          padding: 10px;
        }
      }
      .checkbox-group {
        display: flex;
        justify-content: space-between;
      }
      .checkbox-group input[type="checkbox"] {
        margin-right: 5px;
      }
      .checkbox-group label {
        margin-right: 10px;
      }
    </style>
    </head>
    <body>
    <h1>欢迎使用ChatGPT</h1>
    <form method="POST">
      <label for="unique_name">请输入本网站使用密码：</label>
      <input type="text" id="site_password" name="site_password" placeholder="">
      <label for="unique_name">请输入独一无二的名字，以你的区分身份，用于会话隔离：</label>
      <input type="text" id="unique_name" name="unique_name" placeholder="" required value="">
    <br></br>
      <button type="submit">访问使用</button>
    </form>
    </body>
    </html>
    `;

    return new Response(formHtml, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8'
      },
    });
  }
}
