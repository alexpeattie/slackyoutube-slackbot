const Botkit = require('botkit')
const request = require('request')
const PORT = process.env.PORT || 8080

const controller = Botkit.slackbot({
  debug: false
});

const bot = controller.spawn({
  token: process.env.SLACK_TOKEN
}).startRTM();

controller.hears(['subscribe to ([a-z0-9_\\-,\\s]+)'], 'direct_message,direct_mention,mention', (bot, message) => {
  var channelId = message.match[1]

  bot.api.users.info({ user: message.user }, (error, response) => {
    let { name, real_name } = response.user;
    bot.reply(message, `Ok <@${ name }>, I'll try and set up a subscription to ${ channelId }...`)

    let newSubUrl = `https://y026iupl4i.execute-api.us-east-1.amazonaws.com/latest/subscription?id_or_username=${ channelId }&slack_channel_id=${ message.channel }`
    request.post(newSubUrl, (error, subResponse) => {
      if (!error && subResponse.statusCode == 200) {
        bot.reply(message, `Good news, that's all set up for you :thumbsup:. You'll get a notification in this channel whenever ${ channelId } publishes a new video!`)
      } else if(subResponse.statusCode == 404) {
        bot.reply(message, "Hmm it looks like I ran into a problem finding that channel. Is it possible you mispelled the name :speak_no_evil:?")
      } else {
        bot.reply(message, "Sorry, I couldn't set up your subscription :cry:! You can try again later, or contact your administrator if the problem persists.")
      }
    })
  })
})

controller.hears(['unsubscribe from ([a-z0-9_\\-,\\s]+)'], 'direct_message,direct_mention,mention', (bot, message) => {
  var channelId = message.match[1]

  bot.reply(message, `Ok let me remove any subscriptions to ${ channelId }...`)

  let unsubUrl = `https://y026iupl4i.execute-api.us-east-1.amazonaws.com/latest/subscription?id_or_username=${ channelId }&slack_channel_id=${ message.channel }&unsubscribe=true`
  request.post(unsubUrl, (error, subResponse) => {
    if (!error && subResponse.statusCode == 200) {
      bot.reply(message, `OK, you're unsubscribed and won't get anymore notification in this channel about ${ channelId }!`)
    } else if(subResponse.statusCode == 404) {
      bot.reply(message, "Hmm it looks like I ran into a problem finding that channel. Is it possible you mispelled the name :speak_no_evil:?")
    } else {
      bot.reply(message, "Sorry, I couldn't unsubscribe for some reason :cry:! You can try again later, or contact your administrator if the problem persists.")
    }
  })
})

controller.setupWebserver(PORT, (error, webserver) => {
  webserver.post('/video', (req, res) => {
    const missingKeys = ['username', 'title', 'id', 'slack_channel_id', 'type'].filter(k => !req.body[k])
    let eventDescription = (req.body.type == 'published') ? 'published a new video' : 'updated their video'

    if(missingKeys.length === 0) {
      bot.say({
        text: `${ req.body.username } just ${ eventDescription } - *"${ req.body.title }"* (https://www.youtube.com/watch?v=${ req.body.id })`,
        channel: req.body.slack_channel_id
      }, () => { res.status(200).json({ code: "notification_sent", details: "Video notification sent" }) },
         () => { res.status(500).json({ code: "notification_failed", details: "Unexpected server error occured" })
      })
    } else {
      res.status(422).json({ code: "notification_failed", details: `Missing keys: ${ missingKeys.join(', ') }` })
    }
  })
})