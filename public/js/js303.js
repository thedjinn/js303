(function(){ // TODO: Fix sluggishness in wrapper

	var audiotimer;
	var synth;

	var pitchmode=false;
	var currentstep=0;

	function changestep(pos) {
		currentstep=pos;

		$("#stepnumber").css("background-position","-"+(pos*50)+"px 0px");

		var pitch = synth.pattern[pos][0]-40;
		$("#cled").toggleClass("on",pitch==0);
		$("#dbled").toggleClass("on",pitch==1);
		$("#dled").toggleClass("on",pitch==2);
		$("#ebled").toggleClass("on",pitch==3);
		$("#eled").toggleClass("on",pitch==4);
		$("#fled").toggleClass("on",pitch==5);
		$("#gbled").toggleClass("on",pitch==6);
		$("#gled").toggleClass("on",pitch==7);
		$("#abled").toggleClass("on",pitch==8);
		$("#aled").toggleClass("on",pitch==9);
		$("#bbled").toggleClass("on",pitch==10);
		$("#bled").toggleClass("on",pitch==11);
		$("#ccled").toggleClass("on",pitch==12);

		$("#accentled").toggleClass("on",synth.pattern[pos][1]);
		$("#slideled").toggleClass("on",synth.pattern[pos][2]);
		$("#noteled").toggleClass("on",synth.pattern[pos][3]);
		$("#restled").toggleClass("on",!synth.pattern[pos][3]);
		$("#downled").toggleClass("on",synth.pattern[pos][4]);
		$("#upled").toggleClass("on",synth.pattern[pos][5]);
	}

	$(function(){
		// init synth
		synth = new TB303;
		if (typeof song !== "undefined") {
			synth.unserialize(song);
		}

		// set up interface
		$("#tempo").dial({
			numImages: 41,
			imageWidth: 36,
			min: 20.0,
			max: 200.0,
			value: synth.tempo,
			unitsPerPixel: 1,
			change: function(e,u){
				synth.settempo(u.value);
			}
		});
		$("#threshold").dial({
			numImages: 41,
			imageWidth: 36,
			min: 0.0,
			max: 1.0,
			value: synth.dist_threshold,
			unitsPerPixel: 0.01,
			change: function(e,u){
				synth.setdistthreshold(u.value);
			}
		});
		$("#shape").dial({
			numImages: 41,
			imageWidth: 36,
			min: 0.0,
			max: 1.0,
			value: synth.dist_shape,
			unitsPerPixel: 0.01,
			change: function(e,u){
				synth.dist_shape = u.value;
			}
		});
		$("#tuning").dial({
			numImages: 41,
			imageWidth: 36,
			min: -12.0,
			max: 12.0,
			value: synth.tuning,
			unitsPerPixel: 0.1,
			change: function(e,u){
				synth.tuning = u.value;
			}
		});
		$("#cutoff").dial({
			numImages: 41,
			imageWidth: 36,
			min: 200.0,
			max: 20000.0,
			value: synth.cutoff,
			unitsPerPixel: 100,
			change: function(e,u){
				synth.setcutoff(u.value);
			}
		});
		$("#resonance").dial({
			numImages: 41,
			imageWidth: 36,
			min: 0.0,
			max: 1.0,
			value: synth.resonance,
			unitsPerPixel: 0.01,
			change: function(e,u) {
				synth.setresonance(u.value);
			}
		});
		$("#envmod").dial({
			numImages: 41,
			imageWidth: 36,
			min: 0.0,
			max: 1.0,
			value: synth.envmod,
			unitsPerPixel: 0.01,
			change: function(e,u) {
				synth.setenvmod(u.value);
			}
		});
		$("#decay").dial({
			numImages: 41,
			imageWidth: 36,
			min: 100.0,
			max: 2000.0,
			value: synth.decay,
			unitsPerPixel: 2,
			change: function(e,u) {
				synth.decay = u.value;
			}
		});
		$("#accent").dial({
			numImages: 41,
			imageWidth: 36,
			min: 0.0,
			max: 1.0,
			value: synth.accent,
			unitsPerPixel: 0.01,
			change: function(e,u) {
				synth.accent = u.value;
			}
		});

		$("#waveform").change(function(e) {
			synth.waveform = $(this).attr("checked")?1:0;
		}).attr("checked",synth.waveform==1?true:false);

		$("#stepbutton").click(function(e) {
			changestep((currentstep+1)%synth.pattern.length);
		});

		$("#backbutton").click(function(e) {
			changestep((currentstep+synth.pattern.length-1)%synth.pattern.length);
		});

		$("#gatebutton").click(function(e) {
			synth.pattern[currentstep][3]=!synth.pattern[currentstep][3];
			$("#noteled").toggleClass("on",synth.pattern[currentstep][3]);
			$("#restled").toggleClass("on",!synth.pattern[currentstep][3]);
		});

		$("#downbutton").click(function(e) {
			synth.pattern[currentstep][4]=!synth.pattern[currentstep][4];
			$("#downled").toggleClass("on",synth.pattern[currentstep][4]);
		});
		
		$("#upbutton").click(function(e) {
			synth.pattern[currentstep][5]=!synth.pattern[currentstep][5];
			$("#upled").toggleClass("on",synth.pattern[currentstep][5]);
		});
		
		$("#accentbutton").click(function(e) {
			synth.pattern[currentstep][1]=!synth.pattern[currentstep][1];
			$("#accentled").toggleClass("on",synth.pattern[currentstep][1]);
		});
		
		$("#slidebutton").click(function(e) {
			synth.pattern[currentstep][2]=!synth.pattern[currentstep][2];
			$("#slideled").toggleClass("on",synth.pattern[currentstep][2]);
		});

		$("#pitchmodebutton").click(function(e) {
			pitchmode=!pitchmode;
			$("#pitchmodeled").toggleClass("on",pitchmode);
		});

		$("#clearbutton").click(function(e) {
			synth.pattern[currentstep][0]=40;
			synth.pattern[currentstep][1]=false;
			synth.pattern[currentstep][2]=false;
			synth.pattern[currentstep][3]=false;
			synth.pattern[currentstep][4]=false;
			synth.pattern[currentstep][5]=false;
			changestep(currentstep);
		});

		var changenote = function(e) {
			var notes=["c","db","d","eb","e","f","gb","g","ab","a","bb","b","cc"];
			if (pitchmode) {
				synth.pattern[currentstep][0]=e.data.number+40;
				changestep((currentstep+1)%synth.pattern.length);
			} else {
				$("#"+notes[synth.pattern[currentstep][0]-40]+"led").removeClass("on");
				synth.pattern[currentstep][0]=e.data.number+40;
				$("#"+notes[synth.pattern[currentstep][0]-40]+"led").addClass("on");
			}
		};
		$("#cbutton").click({number:0},changenote);
		$("#dbbutton").click({number:1},changenote);
		$("#dbutton").click({number:2},changenote);
		$("#ebbutton").click({number:3},changenote);
		$("#ebutton").click({number:4},changenote);
		$("#fbutton").click({number:5},changenote);
		$("#gbbutton").click({number:6},changenote);
		$("#gbutton").click({number:7},changenote);
		$("#abbutton").click({number:8},changenote);
		$("#abutton").click({number:9},changenote);
		$("#bbbutton").click({number:10},changenote);
		$("#bbutton").click({number:11},changenote);
		$("#ccbutton").click({number:12},changenote);

		$("#run").click(function(e){
//			clearInterval(audiotimer);
			synth.running=!synth.running;
		});

		$("#createpermalink a").click(function(e) {
			$("#createpermalink").slideUp(200);
			$.ajax({
				data: {
					data:JSON.stringify(synth.serialize())
				},
				dataType: "text",
				error: function(xhr,stat,err) { alert("Oops! Something went horribly wrong: stat="+stat+" err="+err); },
				success: function(data, status, xhr) {
					$("#permalink .url").html("http://js303.com/s/"+data);
					$("#permalink").slideDown(200);
				},
				type: "POST",
				url: "/store"
			});
		});

		changestep(currentstep);
		
		// initialize wavetable
		loadwavetable("/data/wavetable.png", function() {

			// set up synth
			var audio = new Audio();
			if (typeof audio.mozSetup == 'function') {
				audio.mozSetup(1,44100);

				var apos=0;
				var buf = new Float32Array(4410);
				audiotimer = setInterval(function() {
					var before = +new Date();
					var b = buf, r = synth;
					for (var i=0;i<4410;i++) {
						b[i]=r.render();
					}
					apos+=audio.mozWriteAudio(b);
					var after = +new Date();
					$("#load").html((after-before)+"%");
				},100);
			} else {
				// no audio data api available
			}

		});

	});
})();
