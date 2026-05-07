import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'dd.dexscreener.com' },
      { protocol: 'https', hostname: '*.dexscreener.com' },
      { protocol: 'https', hostname: 'pump.mypinata.cloud' },
      { protocol: 'https', hostname: 'cf-ipfs.com' },
      { protocol: 'https', hostname: 'ipfs.io' },
      { protocol: 'https', hostname: 'arweave.net' },
      { protocol: 'https', hostname: '*.arweave.net' },
      { protocol: 'https', hostname: 'shdw-drive.genesysgo.net' },
    ],
  },
}

export default nextConfig
