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
  console.log(message.channel)

  bot.api.users.info({ user: message.user }, (error, response) => {
    let { name, real_name } = response.user;
    bot.reply(message, `Ok <@${ name }>, I'll try and set up a subscription to ${ channelId }...`)

    let newSubUrl = `https://y026iupl4i.execute-api.us-east-1.amazonaws.com/latest/subscription?channel=${ channelId }&slack_cid=${ message.channel }`
    request(newSubUrl, (error, subResponse) => {
      if (!error && subResponse.statusCode == 200) {
        bot.reply(message, `Good news, that's all set up for you :thumbsup:. You'll get a notification in this channel whenever ${ channelId } publishes a new video!`)
      } else {
        bot.reply(message, "Sorry, I couldn't set up your subscription :cry:! You can try again later, or contact your administrator if the problem persists.")
      }
    })
  })
})

controller.setupWebserver(PORT, (error, webserver) => {
  webserver.post('/video', (req, res) => {
    bot.api.channels.list({}, (error, channelResponse) => {
      let channel = channelResponse.channels.find(c => c.name == 'general').id
      const missingKeys = ['username', 'title', 'id'].filter(k => !req.body[k])

      if(missingKeys.length === 0) {
        bot.say({
          text: `${ req.body.username } just published a new video - *"${ req.body.title }"* (https://www.youtube.com/watch?v=${ req.body.id })`,
          channel
        }, () => { res.status(200).json({ code: "notification_sent", details: "Video notification sent" }) },
           () => { res.status(500).json({ code: "notification_failed", details: "Unexpected server error occured" })
        })
      } else {
        res.status(422).json({ code: "notification_failed", details: `Missing keys: ${ missingKeys.join(', ') }` })
      }
    })
  })
})