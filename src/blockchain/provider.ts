import { CeloProvider } from '@celo-tools/celo-ethers-wrapper'
import { providers } from 'ethers'
import { config } from 'src/config'
import { STALE_BLOCK_TIME } from 'src/consts'
import { setIsConnected } from 'src/features/wallet/walletSlice'
import { logger } from 'src/utils/logger'
import { promiseTimeout, sleep } from 'src/utils/promises'
import { isStale } from 'src/utils/time'
import { call, put } from 'typed-redux-saga'

let provider: CeloProvider | undefined

export function isProviderSet() {
  return !!provider
}

export function* initProvider() {
  try {
    yield* call(connectToProvider)
    yield* put(setIsConnected(true))
  } catch (error) {
    logger.error('Unable to connect to provider', error)
    yield* put(setIsConnected(false))
  }
}

async function connectToProvider() {
  const { jsonRpcUrlPrimary, jsonRpcUrlSecondary } = config

  let connectionResult = await connectToJsonRpcProvider(jsonRpcUrlPrimary)

  if (!connectionResult && jsonRpcUrlSecondary) {
    connectionResult = await connectToJsonRpcProvider(jsonRpcUrlSecondary)
  }

  if (!connectionResult) {
    throw new Error('All json rpc providers failed to connect')
  }
}

async function connectToJsonRpcProvider(url: string) {
  try {
    logger.info(`Connecting to json rpc provider: ${url}`)
    provider = new CeloProvider(url)
    for (let i = 0; i < 3; i++) {
      const blockAndNetworkP = Promise.all([provider.getBlock('latest'), provider.getNetwork()])
      const blockAndNetwork = await promiseTimeout(blockAndNetworkP, 1000)
      if (blockAndNetwork && isProviderSynced(blockAndNetwork[0], blockAndNetwork[1])) {
        logger.info('Provider is connected')
        return true
      }
      // Otherwise wait a bit and then try again
      await sleep(1000)
    }
    throw new Error('Unable to sync after 3 attempts')
  } catch (error) {
    logger.error(`Failed to connect to json rpc provider: ${url}`, error)
    clearProvider()
    return false
  }
}

function isProviderSynced(block?: providers.Block, network?: providers.Network) {
  return (
    block &&
    block.number &&
    block.timestamp &&
    !isStale(block.timestamp * 1000, STALE_BLOCK_TIME) &&
    network &&
    network.chainId === config.chainId
  )
}

export function getProvider() {
  if (!provider) {
    logger.error('Provider is not yet initialized')
    throw new Error('Attempting to use provider before initialized')
  }
  return provider
}

export function clearProvider() {
  provider = undefined
}
