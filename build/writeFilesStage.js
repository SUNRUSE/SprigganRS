import InstancedStage from "./instancedStage"
import WriteFileStage from "./writeFileStage"

export default class WriteFilesStage extends InstancedStage {
  constructor(parent, name, dependencies, cacheInstances, filesFactory, destinationPrefixPathSegmentFactory) {
    super(parent, name, dependencies, cacheInstances, instance => new WriteFileStage(this, instance.name, [], () => destinationPrefixPathSegmentFactory().concat([instance.name]), () => instance.contents))
    this.filesFactory = filesFactory
  }

  getInstanceKey(instance) {
    return instance.name
  }

  getInstances() {
    this.gotInstances(this.filesFactory())
  }
}
