# Webtendo Client

[Download in iTunes](https://itunes.apple.com/us/app/webtendo/id1180349310)

iOS controller for [8enmann/webtendo](https://github.com/8enmann/webtendo) since iOS doesn't have WebRTC. Uses RN for the transport layer and webview for the controller and touch handling. This allows maximum code reuse.

Dev target expects a webtendo instance to be running locally.

## Run
```
npm install
react-native run ios
```

## TODO
- [ ] Android client
- [ ] Allow tablets to host by passing URL changes back to RN
- [ ] Allow backing out of controller to game select screen
- [ ] Connection status like web
