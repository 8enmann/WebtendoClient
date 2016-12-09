# Webtendo Client

iOS controller for 8enmann/webtendo since iOS doesn't have WebRTC. Uses RN for the transport layer and webview for the controller and touch handling. This allows maximum code reuse.

Expects a webtendo instance to be running. Currently defaults to http://localhost:8080/client-no-transport.html as the controller.

# Run
```
npm install
react-native run ios
```

# TODO
[ ] Android client
[ ] Allow tablets to host by passing URL changes back to RN
[ ] Allow backing out of controller to game select screen
[ ] Connection status like web
