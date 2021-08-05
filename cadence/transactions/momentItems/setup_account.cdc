import NonFungibleToken from "../../contracts/NonFungibleToken.cdc"
import MomentItems from "../../contracts/MomentItems.cdc"

// This transaction configures an account to hold Moment Item.

transaction {
    prepare(signer: AuthAccount) {
        // if the account doesn't already have a collection
        if signer.borrow<&MomentItems.Collection>(from: MomentItems.CollectionStoragePath) == nil {

            // create a new empty collection
            let collection <- MomentItems.createEmptyCollection()

            // save it to the account
            signer.save(<-collection, to: MomentItems.CollectionStoragePath)

            // create a public capability for the collection
            signer.link<&MomentItems.Collection{NonFungibleToken.CollectionPublic, MomentItems.MomentItemsCollectionPublic}>(MomentItems.CollectionPublicPath, target: MomentItems.CollectionStoragePath)
        }
    }
}