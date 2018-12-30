import * as util from "util"
import * as fs from "fs"
import * as path from "path"
import * as faviconsType from "favicons"
const favicons = util.promisify(require(`favicons`) as (
  source: string,
  configuration: Partial<faviconsType.Configuration>,
  callback: faviconsType.Callback
) => void)
const isPng = require(`is-png`)
const pngcrushBin = require(`pngcrush-bin`)
const execBuffer = require(`exec-buffer`)
import * as htmlMinifier from "html-minifier"
import * as types from "./types"

const fsWriteFile = util.promisify(fs.writeFile)

type htmlMetadata = {
  readonly title: string
  readonly description: string
  readonly developer: {
    readonly name: string
    readonly url: string
  }
}

export default async function (
  createdOrModifiedFiles: Set<string>,
  buildName: types.buildName,
  iconPath: string,
  destination: string,
  oldMetadata: htmlMetadata,
  newMetadata: htmlMetadata,
  body: string
): Promise<void> {
  if (createdOrModifiedFiles.has(iconPath)
    || newMetadata.title != oldMetadata.title
    || newMetadata.description != oldMetadata.description
    || newMetadata.developer.name != oldMetadata.developer.name
    || newMetadata.developer.url != oldMetadata.developer.url
  ) {
    console.log(`Generating favicons...`)
    const response = await favicons(iconPath, {
      appName: newMetadata.title,
      appDescription: newMetadata.description,
      developerName: newMetadata.developer.name,
      developerURL: newMetadata.developer.url,
      background: `#000`,
      theme_color: `#000`,
      path: ``,
      display: `standalone`,
      orientation: `landscape`,
      start_url: ``,
      version: `1.0` /* TODO: Get Git commit hash. */,
      logging: false,
      icons: {
        android: buildName == `oneOff`,
        appleIcon: buildName == `oneOff`,
        appleStartup: buildName == `oneOff`,
        coast: buildName == `oneOff`,
        favicons: true,
        firefox: buildName == `oneOff`,
        windows: buildName == `oneOff`,
        yandex: buildName == `oneOff`
      }
    })

    const files = response.images.concat(response.files)
    let compressed = 0
    let written = 0
    const total = files.length

    const promises = files.map(async file => {
      if (buildName == `oneOff` && isPng(file.contents)) {
        console.log(`Compressing favicon file "${file.name}"...`)
        const compressed = await execBuffer({
          input: file.contents,
          bin: pngcrushBin,
          args: [`-brute`, `-force`, `-q`, `-reduce`, execBuffer.input, execBuffer.output]
        })
        file.contents = compressed
      }
      console.log(`Writing favicon file "${file.name}" (compressed ${++compressed}/written ${written}/total ${total})...`)
      await fsWriteFile(
        path.join(destination, file.name),
        file.contents
      )

      console.log(`Written favicon file "${file.name}" (compressed ${compressed}/written ${++written}/total ${total}).`)
    })

    for (const promise of promises) {
      await promise
    }

    console.log(`All files written.`)
    let html = `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>${newMetadata.title}</title>
        <meta name="viewport" content="initial-scale=1, minimum-scale=1, maximum-scale=1, width=device-width, height=device-height, user-scalable=no">
        ${response.html.join(``)}
      </head>
      ${body}
    </html>`
    if (buildName == `oneOff`) {
      html = htmlMinifier.minify(html, {
        caseSensitive: false,
        collapseBooleanAttributes: true,
        collapseInlineTagWhitespace: true,
        collapseWhitespace: true,
        conservativeCollapse: false,
        customAttrAssign: [],
        customAttrSurround: [],
        customEventAttributes: [],
        decodeEntities: true,
        html5: true,
        ignoreCustomComments: [],
        ignoreCustomFragments: [],
        includeAutoGeneratedTags: false,
        keepClosingSlash: false,
        minifyCSS: {
          level: {
            2: {
              all: true
            }
          }
        } as any,
        minifyJS: false,
        minifyURLs: false,
        preserveLineBreaks: false,
        preventAttributesEscaping: false,
        processConditionalComments: false,
        processScripts: [],
        quoteCharacter: `"`,
        removeAttributeQuotes: true,
        removeComments: true,
        removeEmptyAttributes: true,
        removeEmptyElements: true,
        removeOptionalTags: true,
        removeRedundantAttributes: true,
        removeScriptTypeAttributes: true,
        removeStyleLinkTypeAttributes: true,
        removeTagWhitespace: true,
        sortAttributes: true,
        sortClassName: true,
        trimCustomFragments: true,
        useShortDoctype: true
      })
    }

    console.log(`Writing "${path.join(destination, `index.html`)}"...`)
    await fsWriteFile(
      path.join(destination, `index.html`),
      html
    )
  } else {
    console.log(`Skipped regeneration of HTML.`)
  }
}
