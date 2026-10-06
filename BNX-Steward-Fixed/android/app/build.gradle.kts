plugins { id("com.android.application") }

android {
    namespace = "in.balajinextgen.stewardprinter"
    compileSdk = 34

    defaultConfig {
        applicationId = "in.balajinextgen.stewardprinter"
        minSdk = 24
        targetSdk = 34
        versionCode = 3
        versionName = "2.0.0"
    }

    // One fixed key for every build. GitHub Actions otherwise makes a NEW random debug key on each run,
    // and Android then refuses to install the new APK over the old one ("App not installed").
    signingConfigs {
        create("bnx") {
            storeFile = file("bnx-steward.keystore")
            storePassword = "bnxsteward"
            keyAlias = "bnx"
            keyPassword = "bnxsteward"
        }
    }
    buildTypes {
        getByName("debug") { signingConfig = signingConfigs.getByName("bnx") }
        getByName("release") {
            signingConfig = signingConfigs.getByName("bnx")
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
