import {
  QueryResolvers,
  ResolversTypes,
  Asset as SchemaAsset,
  MutationResolvers,
  AssetResolvers
} from '../generated/graphql'
import { Asset } from '../../asset/model'
import { AssetError, isAssetError } from '../../asset/errors'
import { ApolloContext } from '../../app'
import { getPageInfo } from '../../shared/pagination'
import { Pagination } from '../../shared/baseModel'
import { feeToGraphql } from './fee'
import { FeeType } from '../../fee/model'

export const getAssets: QueryResolvers<ApolloContext>['assets'] = async (
  parent,
  args,
  ctx
): Promise<ResolversTypes['AssetsConnection']> => {
  const assetService = await ctx.container.use('assetService')
  const assets = await assetService.getPage(args)
  const pageInfo = await getPageInfo(
    (pagination: Pagination) => assetService.getPage(pagination),
    assets
  )
  return {
    pageInfo,
    edges: assets.map((asset: Asset) => ({
      cursor: asset.id,
      node: assetToGraphql(asset)
    }))
  }
}

export const getAsset: QueryResolvers<ApolloContext>['asset'] = async (
  parent,
  args,
  ctx
): Promise<ResolversTypes['Asset']> => {
  const assetService = await ctx.container.use('assetService')
  const asset = await assetService.get(args.id)
  if (!asset) {
    throw new Error('No asset')
  }
  return assetToGraphql(asset)
}

export const createAsset: MutationResolvers<ApolloContext>['createAsset'] =
  async (
    parent,
    args,
    ctx
  ): Promise<ResolversTypes['AssetMutationResponse']> => {
    try {
      const assetService = await ctx.container.use('assetService')
      const assetOrError = await assetService.create(args.input)
      if (isAssetError(assetOrError)) {
        switch (assetOrError) {
          case AssetError.DuplicateAsset:
            return {
              code: '409',
              message: 'Asset already exists',
              success: false
            }
          default:
            throw new Error(`AssetError: ${assetOrError}`)
        }
      }
      return {
        code: '200',
        success: true,
        message: 'Created Asset',
        asset: assetToGraphql(assetOrError)
      }
    } catch (error) {
      ctx.logger.error(
        {
          options: args.input,
          error
        },
        'error creating asset'
      )
      return {
        code: '500',
        message: 'Error trying to create asset',
        success: false
      }
    }
  }

export const updateAsset: MutationResolvers<ApolloContext>['updateAsset'] =
  async (
    parent,
    args,
    ctx
  ): Promise<ResolversTypes['AssetMutationResponse']> => {
    try {
      const assetService = await ctx.container.use('assetService')
      const assetOrError = await assetService.update({
        id: args.input.id,
        withdrawalThreshold: args.input.withdrawalThreshold ?? null,
        liquidityThreshold: args.input.liquidityThreshold ?? null
      })
      if (isAssetError(assetOrError)) {
        switch (assetOrError) {
          case AssetError.UnknownAsset:
            return {
              code: '404',
              message: 'Unknown asset',
              success: false
            }
          default:
            throw new Error(`AssetError: ${assetOrError}`)
        }
      }
      return {
        code: '200',
        success: true,
        message: 'Updated Asset',
        asset: assetToGraphql(assetOrError)
      }
    } catch (error) {
      ctx.logger.error(
        {
          options: args.input,
          error
        },
        'error updating asset'
      )
      return {
        code: '400',
        message: 'Error trying to update asset',
        success: false
      }
    }
  }

export const getAssetSendingFee: AssetResolvers<ApolloContext>['sendingFee'] =
  async (parent, args, ctx): Promise<ResolversTypes['Fee'] | null> => {
    if (!parent.id) return null

    const feeService = await ctx.container.use('feeService')
    const fee = await feeService.getLatestFee(parent.id, FeeType.Sending)

    if (!fee) return null

    return feeToGraphql(fee)
  }

export const getAssetReceivingFee: AssetResolvers<ApolloContext>['receivingFee'] =
  async (parent, args, ctx): Promise<ResolversTypes['Fee'] | null> => {
    if (!parent.id) return null

    const feeService = await ctx.container.use('feeService')
    const fee = await feeService.getLatestFee(parent.id, FeeType.Receiving)

    if (!fee) return null

    return feeToGraphql(fee)
  }

export const assetToGraphql = (asset: Asset): SchemaAsset => ({
  id: asset.id,
  code: asset.code,
  scale: asset.scale,
  withdrawalThreshold: asset.withdrawalThreshold,
  liquidityThreshold: asset.liquidityThreshold,
  createdAt: new Date(+asset.createdAt).toISOString()
})
