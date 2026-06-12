/*******************************************************
 BALAJI NEXTGEN ERP
 FILE : service-worker.js
 PURPOSE : OFFLINE CACHE + PWA SUPPORT
********************************************************/


/* =====================================================
   CACHE NAME
===================================================== */

const CACHE_NAME =
  "BALAJI_NEXTGEN_CACHE_V3";



/* =====================================================
   FILES TO CACHE
===================================================== */

const urlsToCache = [

  "/",
  "/index.html",
  "/client-login.html",
  "/dashboard.html",

  "/logo.png",

  "/manifest.json",

  "/css/style.css",
  "/css/dashboard.css",

  "/js/app.js",
  "/js/login.js",
  "/js/dashboard.js"

];



/* =====================================================
   INSTALL SERVICE WORKER
===================================================== */

self.addEventListener(
  "install",

  event => {

    console.log(
      "ERP SERVICE WORKER INSTALLING"
    );

    event.waitUntil(

      caches.open(CACHE_NAME)

        .then(cache => {

          console.log(
            "ERP CACHE CREATED"
          );

          return cache.addAll(
            urlsToCache
          );

        })

        .catch(error => {

          console.log(
            "CACHE INSTALL ERROR",
            error
          );

        })

    );

  }

);



/* =====================================================
   FETCH CACHE
===================================================== */

self.addEventListener(
  "fetch",

  event => {

    event.respondWith(

      caches.match(
        event.request
      )

      .then(response => {

        if(response) {

          return response;

        }

        return fetch(
          event.request
        );

      })

      .catch(error => {

        console.log(
          "FETCH ERROR",
          error
        );

      })

    );

  }

);



/* =====================================================
   ACTIVATE SERVICE WORKER
===================================================== */

self.addEventListener(
  "activate",

  event => {

    console.log(
      "BALAJI NEXTGEN ERP SERVICE WORKER LOADED"
    );

    event.waitUntil(

      caches.keys()

        .then(cacheNames => {

          return Promise.all(

            cacheNames.map(cache => {

              if(cache !== CACHE_NAME) {

                console.log(
                  "OLD CACHE REMOVED:",
                  cache
                );

                return caches.delete(
                  cache
                );

              }

            })

          );

        })

    );

  }

);



/* =====================================================
   BACKGROUND SYNC
===================================================== */

self.addEventListener(
  "sync",

  event => {

    console.log(
      "BACKGROUND SYNC ACTIVE"
    );

  }

);



/* =====================================================
   PUSH NOTIFICATION
===================================================== */

self.addEventListener(
  "push",

  event => {

    const options = {

      body:
        "BALAJI NEXTGEN ERP Notification",

      icon:
        "/logo.png",

      badge:
        "/logo.png"

    };

    event.waitUntil(

      self.registration.showNotification(

        "BALAJI NEXTGEN ERP",

        options

      )

    );

  }

);



/* =====================================================
   NOTIFICATION CLICK
===================================================== */

self.addEventListener(
  "notificationclick",

  event => {

    event.notification.close();

    event.waitUntil(

      clients.openWindow(
        "/dashboard.html"
      )

    );

  }

);