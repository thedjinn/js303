var wavetable;
var samplerate = 44100;

// onepole filter coefficients
function coeff_highpass(cutoff) {
	var x = Math.exp(-2.0*Math.PI*cutoff*(1.0/samplerate));
	return [0,0,0.5*(1.0+x),-0.5*(1.0+x),x];
}

function coeff_allpass(cutoff) {
	var t = Math.tan(Math.PI*cutoff*(1.0/samplerate));
	var x = (t-1.0)/(1+1.0);
	return [0,0,x,1.0,-x];
}

// biquad filter coefficients
function coeff_biquad_lowpass12db(freq,gain) {
	var w = 2.0*Math.PI*freq/samplerate;
	var s = Math.sin(w);
	var c = Math.cos(w);
	var q = gain;
	var alpha = s/(2.0*q);
	var scale = 1.0/(1.0+alpha);
	var a1 = 2.0*c*scale;
	var a2 = (alpha-1.0)*scale;
	var b1 = (1.0-c)*scale;
	var b0 = 0.5*b1;
	var b2 = b0;
	return [0,0,0,0,b0,b1,b2,a1,a2];
}

function sinh(x) {
	return (Math.exp(x)-Math.exp(-x))*0.5;
}

function coeff_biquad_notch(freq,bandwidth) {
	var w = 2.0*Math.PI*freq/samplerate;
	var s = Math.sin(w);
	var c = Math.cos(w);
	var alpha = s*sinh(0.5*Math.log(2.0)*bandwidth*w/s);
	var scale = 1.0/(1.0+alpha);
	var a1 = 2.0*c*scale;
	var a2 = (alpha-1.0)*scale;
	var b0 = 1.0*scale;
	var b1 = -2.0*c*scale;
	var b2 = 1.0*scale;
	return [0,0,0,0,b0,b1,b2,a1,a2];
}

// leaky integrator coefficient from decay time in ms
function coeff_integrator(decaytime) {
	return Math.exp(-1.0/(samplerate*0.001*decaytime));
}

// 303 class
var TB303 = function() {
	// sound settings
	this.tempo = 100; // bpm
	this.tuning = 0.0; // semitones
	this.waveform = 0; // 0 for saw, 1 for square
	this.cutoff = 240.0; // Hz
	this.resonance = 1.0; // 0..1
	this.envmod = 0.0; // 0..1
	this.decay = 100; // ms
	this.accent = 0.0; // 0..1
	this.dist_shape = 0.0; // 0..1
	this.dist_threshold = 1.0; // 0.1..1
	this.delay_feedback = 0.5;
	this.delay_send = 0.5;
	this.delay_length = 20000;
	this.running = true;

	// filter states
	this.onepole = []; // [x1,y1,b0,b1,a1] nested in [highpass1,feedbackhighpass,allpass,highpass2]
	this.biquad = []; // [x1,x2,y1,y2,b0,b1,b2,a1,a2] nested in [declicker,notch]
	this.tbfilter = [0,0,0,0,0]; // [y0,y1,y2,y3,y4]
	this.resonance_skewed=0;
	this.tbf_b0=0;/*tbf_a1=0,tbf_y0=0,tbf_y1=0,tbf_y2=0,tbf_y3=0,tbf_y4=0,*/
	this.tbf_k=0;
	this.tbf_g=1.0;

	// synth state
	this.steplength=0;
	this.samplepos=1000000;
	this.pos=-1;
	this.slidestep=0;
	this.table=0;
	this.oscpos=0;
	this.oscdelta=0;
	this.ampenv=0;
	this.filterenv=0;
	this.slide=0;
	this.filtermult=0;
	this.ampmult=0;
	this.accentgain=0.0;
	this.envscaler=0.0;
	this.envoffset=0.0;
	this.dist_gain = 1.0/this.dist_threshold;
	this.delaybuffer = new Float32Array(2*samplerate);
	this.delaypos=0;
	
	// [note<int>,accent<bool>,slide<bool>,gate<bool>,down<bool>,up<bool>]
	this.pattern = [
		[40,true,false,true,false,false],
		[40,false,true,true,false,false],
		[40,false,true,true,false,false],
		[40,false,true,true,false,false],
		[40,false,false,true,false,false],
		[40,false,true,true,false,false],
		[40,true,true,true,false,false],
		[40,false,true,true,false,false],
		[40,false,false,true,false,false],
		[47,true,false,true,false,false],
		[42,false,false,true,false,false],
		[48,true,false,true,false,false],
		[43,false,false,true,false,false],
		[50,false,false,true,false,false],
		[50,true,true,true,true,false],
		[50,false,true,true,true,false]
	];

	// serialization functions
	this.serialize = function() {
		return [
			this.pattern,
			this.tempo,
			this.tuning,
			this.waveform,
			this.cutoff,
			this.resonance,
			this.envmod,
			this.decay,
			this.accent,
			this.dist_shape,
			this.dist_threshold,
			this.delay_feedback,
			this.delay_send,
			this.delay_length
		];
	};

	this.unserialize = function(o) {
		this.pattern=o[0].slice(0);
		this.settempo(o[1]);
		this.tuning=o[2];
		this.waveform=o[3];
		this.envmod=o[6];
		this.setresonance(o[5]);
		this.setcutoff(o[4]);
		this.decay=o[7];
		this.accent=o[8];
		this.dist_shape=o[9];
		this.setdistthreshold(o[10]);
		this.delay_feedback=o[11];
		this.delay_send=o[12];
		this.delay_length=o[13];
	};

	// sound parameter setters
	this.settempo = function(newtempo) {
		this.tempo=newtempo;
		this.steplength=samplerate*60.0/this.tempo/4.0;
	};

	this.setdistthreshold = function(newthresh) {
		// TODO: this destroys threshold value
		this.dist_threshold = 1.0-0.9*newthresh;
		this.dist_gain = 1.0/this.dist_threshold;
	};

	this.setcutoff = function(newcutoff) {
		this.cutoff = newcutoff;
		this.setenvmod(this.envmod);
	};

	this.setresonance = function(newresonance) {
		this.resonance = newresonance;
		this.resonance_skewed = (1.0-Math.exp(-3.0*this.resonance))/(1.0-Math.exp(-3.0));
	};

	this.setenvmod = function(newenvmod) {
		this.envmod = newenvmod;

		var c0 = 3.138152786059267e+2;
		var c1 = 2.394411986817546e+3;
		var c = Math.log(this.cutoff/c0)/Math.log(c1/c0);

		var slo = 3.773996325111173*this.envmod+0.736965594166206;
		var shi = 4.194548788411135*this.envmod+0.864344900642434;

		this.envscaler = (1.0-c)*slo+c*shi;
		this.envoffset = 0.048292930943553*c+0.294391201442418;
	};

	// reset/initialize everything
	this.reset = function() {
		this.onepole = [
			coeff_highpass(44.486),
			coeff_highpass(150.0),
			coeff_allpass(14.008),
			coeff_highpass(24.167)
		];

		this.biquad = [
			coeff_biquad_lowpass12db(200.0,Math.sqrt(0.5)),
			coeff_biquad_notch(7.5164,4.7)
		];

		this.tbfilter = [0,0,0,0,0]; // [y0,y1,y2,y3,y4]
		
		this.settempo(this.tempo);
		this.setdistthreshold(this.dist_threshold);
		this.setresonance(this.resonance);
		this.setenvmod(this.envmod);

		this.samplepos=1000000;
		this.pos=-1;
		this.oscpos=0.0;
	};

	// renderer
	this.render = function() {
		var anti_denormal = 1.0e-20;

		if (this.running) {
			// Step sequencer
			if ((++this.samplepos)>=this.steplength) {
				// Advance sequencer
				this.samplepos=0;
				this.pos=(this.pos+1)&15; // TODO: modulo pattern length for non-16

				// Calculate target pitch
				var pitch = this.pattern[this.pos][0]-this.pattern[this.pos][4]*12+this.pattern[this.pos][5]*12+this.tuning;
				var f = 440.0*Math.pow(2.0,(pitch-69.0)/12.0);

				// Decay multiplier
				this.ampmult = Math.exp(-1.0/(0.001*this.decay*samplerate));
				if (this.pattern[this.pos][1]) { // if accent
					this.filtermult = Math.exp(-1.0/(0.001*200*samplerate));
					this.accentgain = this.accent;
				} else {
					this.filtermult = this.ampmult;
					this.accentgain = 0.0;
				}
				this.ampenv = (1.0/this.ampmult)*this.pattern[this.pos][3];
			
				// VCO parameters
				if (this.pattern[this.pos][2]) { // if slide
					// TODO: set up leaky integrator for slide motion
					this.slide = (this.oscdelta-(f*4096.0/samplerate))/64.0;
					this.slidestep = 0;
				} else {
					this.filterenv = 1.0/this.filtermult;
					this.oscpos=0.0;
					this.slide = 0.0;
					this.slidestep = 64;
					this.oscdelta = f*4096.0/samplerate;
					this.table = this.waveform*524288+(this.pattern[this.pos][0]<<12);
				}
			}
		} else {
			this.ampenv = 0.0;
		}

		// Envelopes
		this.ampenv = this.ampenv * this.ampmult + anti_denormal;
		this.filterenv = this.filterenv * this.filtermult + anti_denormal;
	
		// VCO
		var idx = Math.round(this.oscpos);
		var r = this.oscpos-idx;
		var sample = ((1.0-r)*wavetable[this.table+idx]+r*wavetable[this.table+((idx+1)&4095)]);
		this.oscpos+=this.oscdelta;
		if (this.oscpos>4096.0) {
			this.oscpos-=4096.0;
		}

		// Modulators
		if ((this.samplepos&63)==0) {
			// Portamento
			if (this.slidestep++<64) {
				this.oscdelta-=this.slide; 
			}

			// Cutoff modulation
			var tmp1 = this.envscaler*(this.filterenv-this.envoffset);
			var tmp2 = this.accentgain*this.filterenv;
			var effectivecutoff = Math.min(this.cutoff*Math.pow(2.0,tmp1+tmp2),20000);

			// Recalculate main filter coefficients
			// TODO: optimize into lookup table!
			var wc = ((2.0*Math.PI)/samplerate)*effectivecutoff;
			var r = this.resonance_skewed;
			var fx = wc * 0.11253953951963826; // (1.0/sqrt(2))/(2.0*PI)
			this.tbf_b0 = (0.00045522346 + 6.1922189 * fx) / (1.0 + 12.358354 * fx + 4.4156345 * (fx * fx));
			var k = fx*(fx*(fx*(fx*(fx*(fx+7198.6997)-5837.7917)-476.47308)+614.95611)+213.87126)+16.998792;
			this.tbf_g = (((k * 0.058823529411764705)-1.0)*r+1.0)*(1.0+r);
			this.tbf_k = k*r;
		}

		// High pass filter 1
		var flt = this.onepole[0];
		flt[1] = flt[2]*sample+flt[3]*flt[0]+flt[4]*flt[1]+anti_denormal; // +plus denormalization constant
		flt[0] = sample;
		sample = flt[1];
		
		// Main filter + feedback high pass
		var tbf=this.tbfilter, tbfb0=this.tbf_b0; // prefetch
		var fbhp = this.tbf_k*tbf[4];

		flt = this.onepole[1];
		flt[1] = flt[2]*fbhp+flt[3]*flt[0]+flt[4]*flt[1]+anti_denormal; // +plus denormalization constant
		flt[0] = fbhp;
		fbhp = flt[1];
		
		tbf[0] = sample - fbhp;
		tbf[1] += 2*tbfb0*(tbf[0]-  tbf[1]+tbf[2]);
		tbf[2] +=   tbfb0*(tbf[1]-2*tbf[2]+tbf[3]);
		tbf[3] +=   tbfb0*(tbf[2]-2*tbf[3]+tbf[4]);
		tbf[4] +=   tbfb0*(tbf[3]-2*tbf[4]);
		sample = 2*this.tbf_g*tbf[4];

		// All pass filter
		flt = this.onepole[2];
		flt[1] = flt[2]*sample+flt[3]*flt[0]+flt[4]*flt[1]+anti_denormal; // +plus denormalization constant
		flt[0] = sample;
		sample = flt[1];
		
		// High pass filter 2
		flt = this.onepole[3];
		flt[1] = flt[2]*sample+flt[3]*flt[0]+flt[4]*flt[1]+anti_denormal; // +plus denormalization constant
		flt[0] = sample;
		sample = flt[1];

		// Notch filter
		flt = this.biquad[1];
		var biquady = flt[4]*sample+flt[5]*flt[0]+flt[6]*flt[1]+flt[7]*flt[2]+flt[8]*flt[3]+anti_denormal; // plus denormalization constant
		flt[1] = flt[0];
		flt[0] = sample;
		flt[3] = flt[2];
		flt[2] = biquady;
		sample = biquady;

		// Calculate output gain with declicker filter
		var outputgain = ((this.accentgain*4.0+1.0)*this.ampenv);
		flt = this.biquad[0];
		biquady = flt[4]*outputgain+flt[5]*flt[0]+flt[6]*flt[1]+flt[7]*flt[2]+flt[8]*flt[3]+anti_denormal; // plus denormalization constant
		flt[1] = flt[0];
		flt[0] = outputgain;
		flt[3] = flt[2];
		flt[2] = biquady;
		outputgain = biquady;

		// Apply gain
		sample *= outputgain;

		// Foldback distortion
		if (sample>this.dist_threshold||sample<-this.dist_threshold) {
			//sample = Math.abs(Math.abs((sample-dist_threshold)%(dist_threshold*4.0))-dist_threshold*2.0)-dist_threshold;
			var clipped = (sample>0.0?1.0:-1.0)*this.dist_threshold;
			sample = (Math.abs(Math.abs((((1.0-this.dist_shape)*clipped+this.dist_shape*sample)-this.dist_threshold)%(this.dist_threshold*4.0))-this.dist_threshold*2.0)-this.dist_threshold);
		}
		sample *= this.dist_gain;

		// Delay
		var prev = this.delaybuffer[this.delaypos];
		this.delaybuffer[this.delaypos] = this.delay_send * sample + this.delay_feedback * prev + anti_denormal;
		this.delaypos++;
		if (this.delaypos>this.delay_length) {
			this.delaypos=0;
		}
		sample += prev;
		
		return sample;
	};

	this.reset();
}

function loadwavetable(uri,callback) {
	var img = new Image();
	img.onload = function() {
		var canvas = document.createElement('canvas');
		canvas.width = img.width;
		canvas.height = img.height;

		var ctx = canvas.getContext('2d');
		ctx.drawImage(img,0,0);

		var data = ctx.getImageData(0,0,canvas.width,canvas.height);

		wavetable = new Float32Array((new Uint8Array(data.data)).buffer);

		callback();
	};
	img.src=uri;
}

function genwavetable() {
	wavetable = new Float32Array(2*524288);

	var stab = new Float32Array(4096);
	for (var i=0;i<4096;i++) {
		stab[i] = Math.sin(2.0*Math.PI*(i/4096.0));
	}

	var last = 0;
	var i,j,k,h,m,f,invh;
	for (i=0;i<2*524288;i++) {
		wavetable[i]=0.0;
	}
	for (i=0;i<128;i++) {
		h = Math.round((samplerate>>1)/(440.0*Math.pow(2.0,(i-69.0)/12.0)));
		if (h == last) {
			continue;
		}

		invh = 1.0/h;
		for (j=1;j<=h;j++) {
			m = ((m = Math.cos((j-1)*(0.5*Math.PI)/invh))*m)/j;

			for (k=0;k<4096;k++) {
				f = m*stab[(j*k)&4095];
				wavetable[1+(k+(i<<12))] += f;
				
				if (j&1) {
					wavetable[524288+k+(i<<12)] += f;
				}
			}
		}

		last = h;
	}

	var max0 = 0;
	var max1 = 0;
	for (var i=0;i<524288;i++) {
		max0 = Math.max(max0,Math.abs(wavetable[i]));
		max1 = Math.max(max1,Math.abs(wavetable[524288+i]));
	}

	max0 = 1.0/max0;
	max1 = 1.0/max1;
	for (var i=0;i<524288;i++) {
		wavetable[i]*=max0;
		wavetable[524288+i]*=max1;
	}
}
