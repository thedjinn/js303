#= require jquery/dist/jquery
#= require handlebars/handlebars
#= require emblem/dist/emblem
#= require ember/ember
#= require jquery-knob/dist/jquery.knob.min
#= require synth

lin2exp = (x, inMin, inMax, outMin, outMax) ->
  tmp = (x - inMin) / (inMax - inMin)
  outMin * Math.exp(tmp * Math.log(outMax / outMin))

lin2lin = (x, inMin, inMax, outMin, outMax) ->
  tmp = (x - inMin) / (inMax - inMin)
  outMin + tmp * (outMax - outMin)

randomBool = -> !!Math.round(Math.random())

Ember.Handlebars.registerHelper "group", (options) ->
  data = options.data
  fn = options.fn
  view = data.view

  childView = view.createChildView Ember._MetamorphView,
    context: Ember.get(view, "context")

    template: (context, options) ->
      options.data.insideGroup = true
      return fn(context, options)

  view.appendChild childView

Step = Ember.Object.extend
  pitch: 50
  gate: true
  slide: false
  accent: false
  up: false
  down: false

  randomize: ->
    @set "pitch", 40 + [0, 2, 3, 5, 7, 8, 10, 12][Math.round(7 * Math.random())]
    @set "gate", randomBool()
    @set "slide", randomBool()
    @set "accent", randomBool()
    @set "up", randomBool()
    @set "down", randomBool()

  clear: ->
    @set "pitch", 50
    @set "gate", true
    @set "slide", false
    @set "accent", false
    @set "up", false
    @set "down", false

Pattern = Ember.Object.extend
  numberOfSteps: 16

  init: ->
    @set "steps", (new Step for _ in [0..15])

  randomize: ->
    step.randomize() for step in @get("steps")

  clear: ->
    step.clear() for step in @get("steps")

window.App = App = Ember.Application.create()

App.KnobView = Ember.View.extend
  tagName: "input"

  min: 0
  max: 1
  value: 0.5
  step: 0.01

  initKnob: (->
    @$().knob
      fgColor: "#fc3932"
      bgColor: "#cccccc"
      inputColor: "#000000"
      font: "Abel"
      fontWeight: "normal"
      min: Number(@get("min"))
      max: Number(@get("max"))
      step: Number(@get("step"))
      width: 106
      height: 85
      angleOffset: -125
      angleArc: 250
      change: (value) =>
        @set "value", value

    @$().val(@get("value")).trigger("change")
  ).on('didInsertElement')

  valueChanged: (->
    @$().val(@get("value")).trigger("change")
    @trigger "change"
  ).observes("value")

App.ToggleButtonView = Ember.View.extend
  tagName: "button"
  classNames: ["toggle-button"]
  classNameBindings: ["active:on"]
  templateName: "toggle_button"

  active: true
  title: ""

  mouseDown: ->
    @set "active", !@get("active")

App.ButtonView = Ember.View.extend Ember.TargetActionSupport,
  tagName: "button"
  classNames: ["button"]
  templateName: "button"

  title: ""

  click: ->
    @triggerAction
      action: @get("action")
      target: @get("target")

App.SelectorButtonView = App.ButtonView.extend
  classNameBindings: ["isSelected::grey"]

  isSelected: (->
    @get("value") == @get("variable")
  ).property("value", "variable")

  click: -> @set "variable", @get("value")

App.PitchButtonView = App.SelectorButtonView.extend
  templateName: null
  mouseDown: -> @set "variable", @get("value")
  click: null

App.ApplicationController = Ember.ObjectController.extend
  patterns: (new Pattern for _ in [0..7])
  allowedPitches: [52..40]

  tempo: 120
  cutoff: 0.5
  resonance: 0.5
  envmod: 0.0
  decay: 0.2
  accent: 0.5
  distortion: 0.0
  foldback: 0.0
  delaySteps: 3
  delayMix: 0
  delayFeedback: 0.5
  waveform: 0

  cutoffChanged: (->
    @synth.setcutoff lin2exp(@get("cutoff"), 0, 1, 20, 20000)
  ).observes("cutoff").on("init")

  resonanceChanged: (->
    @synth.setresonance @get("resonance")
  ).observes("resonance").on("init")

  envmodChanged: (->
    @synth.setenvmod @get("envmod")
  ).observes("envmod").on("init")

  decayChanged: (->
    @synth.decay = lin2lin(@get("decay"), 0, 1, 20, 4000)
  ).observes("decay").on("init")

  accentChanged: (->
    @synth.accent = @get("accent")
  ).observes("accent").on("init")

  tempoChanged: (->
    @synth.settempo @get("tempo")
  ).observes("tempo").on("init")

  waveformChanged: (->
    @synth.waveform = @get("waveform") == 1
  ).observes("waveform").on("init")

  distortionChanged: (->
    @synth.setdistthreshold @get("distortion")
  ).observes("distortion").on("init")

  foldbackChanged: (->
    @synth.dist_shape = @get("foldback")
  ).observes("foldback").on("init")

  delayStepsChanged: (->
    @synth.delay_length = @synth.steplength * Math.round(@get("delaySteps"))
  ).observes("delaySteps", "tempo").on("init")

  delayMixChanged: (->
    @synth.delay_send = @get("delayMix")
  ).observes("delayMix").on("init")

  delayFeedbackChanged: (->
    @synth.delay_feedback = @get("delayFeedback")
  ).observes("delayFeedback").on("init")

  columns: (->
    @get("currentPattern").get("steps").map (step, index) ->
      step: step
      index: index + 1
      highlight: index % 4 == 0
  ).property("currentPattern.steps.@each")

  init: ->
    @_super.apply this, arguments

    @synth = new TB303 genwavetable()

    @synth.waveform = 1

    @synth.onStepChanged = => @stepChanged()

    @set "audioManager", new AudioManager(@synth)
    @set "currentPattern", @patterns[0]

  stepChanged: ->
    $(".playing").removeClass("playing")
    $(".step-column").eq(@synth.pos + 1).addClass("playing")

  currentPatternChanged: (->
    @synth.pattern ||= @get("currentPattern")
    @synth.nextPattern = @get("currentPattern")
  ).observes("currentPattern").on("init")

class AudioManager
  constructor: (@synth) ->
    @context = new AudioContext

    @bufferSize = 4096

    @processor = @context.createScriptProcessor @bufferSize, 0, 1
    @processor.onaudioprocess = @audioCallback
    @processor.connect @context.destination

  audioCallback: (e) =>
    output = e.outputBuffer.getChannelData 0

    for i in [0..@bufferSize] by 1
        output[i] = @synth.render()

  start: ->
    @synth.reset()
    @synth.running = true

  stop: ->
    @synth.running = false
    $(".playing").removeClass("playing")
