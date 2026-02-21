// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "QipzActivity",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "QipzActivity",
            targets: ["ActivityRecognitionPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")
    ],
    targets: [
        .target(
            name: "ActivityRecognitionPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Sources/ActivityRecognitionPlugin"),
        .testTarget(
            name: "ActivityRecognitionPluginTests",
            dependencies: ["ActivityRecognitionPlugin"],
            path: "ios/Tests/ActivityRecognitionPluginTests")
    ]
)