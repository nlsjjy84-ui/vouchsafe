/** @type {import('next').NextConfig} */
const nextConfig = {
  // 백엔드(NestJS, 8080번 포트)로 오는 API 요청을 프론트 서버(3000번)가 대신 중계해준다.
  // 이렇게 하면 브라우저 입장에서는 같은 출처(same-origin)로 보이기 때문에
  // CORS 설정을 최소화하면서도, 실제로는 분리 배포된 서버로 요청이 전달된다.
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8080'}/api/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8080'}/uploads/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
