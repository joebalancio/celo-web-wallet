import { logger } from 'ethers'
import { config } from 'src/config'
import { ensureLeading0x } from 'src/utils/addresses'

// From https://github.com/celo-org/celo-monorepo/blob/master/packages%2Fsdk%2Fwallets%2Fwallet-ledger%2Fsrc%2Fdata.ts
const ERC_20_TOKEN_DATA =
  'AAAAaARDRUxPRx7ON1DaI3+TuOM5xTaYm4l4pDgAAAASAACk7DBFAiEA5rECRg94+fCoIvoG9/5qWh62zl2C6Y+aFuuZrFe4CtcCIEJbRrkL3gqwT/Jj+7L3neazgpVCCTZZ3HX9JXXg5vleAAAAaARjVVNEdl3oFoRYYedaJfyhIrtomLixKCoAAAASAACk7DBFAiEApwQFHNBKXp+V2jq8BMD2y/5AwC9bhPQ2H4hT/vMl/B4CIFalOVtBFGREUKMU/F5vDlJLeQrTn6GQeDertpB2FpMvAAAAaARjRVVS2HY8uidqNzjm3oW0s79f3tbWynMAAAASAACk7DBFAiEAh2UeP1+SI2Ed5SiAjpJF6MkMrVa94gUwjJztyBlzhWMCIHfaOrEsxdxAGx+P+hxuSNO4zcw6KRLfJkkuic1V/CrHAAAAagZiIENFTE/dyb5X9VP+dXUtYWBrlMvX4CZO+AAAABIAAPNwMEUCIQCi62KsBfuNcfX0MriiRZ7a5DKERhtIz7sZ1SqBT7ruhgIgVrfmavyWzxzDW4AQeHn++A4qPjB1pQKoHvNXo8Hf1SMAAABpBmIgY1VTRGJJKmRKWI/ZBCcL7QatUrmr/qGuAAAAEgAA83AwRAIgGDYx4oB/gkYUqLeXqvEZXx9nOxVHzTe2ajyd2wnehxgCICQBe/rBPcXiaQJj3pdoXxroct/hV6r3G2G7y79EOEAPAAAAaQZiIGNFVVL57OMBJHrSziGJSUGDCiRw9Od0ygAAABIAAPNwMEQCIEdcFWP+HxEUoF1sCGVd34QGS0hL5cVUdrWdqVm3bYTgAiBCMA+Rg3Ubc3xla/35wzZesPlbeSMEPcr4uqL+8PeydwAAAGoGYSBDRUxP8ZSv31CwPmm9fQV8GqnhDJlU5MkAAAASAACu8zBFAiEAk/o0FBus2/QCrunFGEyoneQIRaMRC+y5L6Dvar8MU/kCIByJt2ziRhDG3AAbyXBIuJfZQujSHFcSJL3xF0xIlcPdAAAAaQZhIGNVU0SHQGn6HrFtRNYi8uDKJe6hcjabwQAAABIAAK7zMEQCIClrH2xgE3WMbD+hgQ7t5SiAcVG5WiUZ655voqCszKEoAiA/cO8UVgNY891MNJ5yeDk8w47WO0E1DQecrK71LR8g8gAAAGoGYSBjRVVSEMiSpuxDpT5F0LkWtLfTg7G3jA8AAAASAACu8zBFAiEAgpktbB1ZxyAwMJwKTSbZ30n8zgRuW0twbXoZxlsUAswCIHek4l4CIbjVMG2HVr0Ml9/8kA4F9dr69JBMaoSUkdKl'

export interface TokenInfo {
  contractAddress: string
  ticker: string
  decimals: number
  chainId: number
  signature: Buffer
  data: Buffer
}

// Map of token address to info
let tokenDataCache: Record<string, TokenInfo> | null = null

export function getTokenData(tokenAddress?: string) {
  if (!tokenAddress) {
    return null
  }

  if (!tokenDataCache) {
    tokenDataCache = {}
    const buf = Buffer.from(ERC_20_TOKEN_DATA, 'base64')
    let i = 0
    while (i < buf.length) {
      const length = buf.readUInt32BE(i)
      i += 4
      const item = buf.slice(i, i + length)
      let j = 0
      const tickerLength = item.readUInt8(j)
      j += 1
      const ticker = item.slice(j, j + tickerLength).toString('ascii')
      j += tickerLength
      const contractAddress: string = ensureLeading0x(item.slice(j, j + 20).toString('hex'))
      j += 20
      const decimals = item.readUInt32BE(j)
      j += 4
      const chainId = item.readUInt32BE(j)
      j += 4
      const signature = item.slice(j)
      const entry: TokenInfo = {
        ticker,
        contractAddress,
        decimals,
        chainId,
        signature,
        data: item,
      }
      if (entry.chainId === config.chainId) {
        tokenDataCache[contractAddress.toLowerCase()] = entry
      }
      i += length
    }
  }

  const tokenData = tokenDataCache[tokenAddress.toLowerCase()]
  if (!tokenData) {
    // Note, there's no data for Alfajores atm, only Mainnet
    logger.debug(`No token data found for ${tokenAddress}`)
    return null
  }
  return tokenData
}
