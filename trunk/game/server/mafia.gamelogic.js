function resolvePlayer(game, tid) {
  if (tid === undefined || tid === null) return null;
  if (tid === -1 || tid === "-1") return null; // 「対象なし」を明示的に無視
  const key = String(tid);
  const players = game?.players || [];
  // uniqueid / id / index のいずれにも耐性
  let p = players.find(p => String(p?.uniqueid ?? p?.id) === key);
  if (!p) {
    // 数値インデックスで来た場合に備えて
    const idx = Number.isFinite(+tid) ? (+tid) : NaN;
    if (Number.isInteger(idx) && idx >= 0 && idx < players.length) {
      p = players[idx];
    }
  }
  return p || null;
}

var getGameLogic = function()
{
	return {
		//////////////////////// Game Logic - Actions //////////////////////////
		'actions_compute':function(maf)
		{
			var 
				_this = this,
				allDeaths = [],
				runningPlayerState = {};
				
			maf.log("Starting action calculations for game=", _this.gameid, ' actionData=', JSON.stringify(_this.actionData), maf.loglevel.NORMAL);
			
			// runningPlayerStates
            Object.keys(_this.players).forEach(function(uniqueId)
			{			
				if(+_this.players[uniqueId].playerstate == 0)
                {
					allDeaths.push(uniqueId);
				}
                else
                {
                    runningPlayerState[uniqueId] = 
                    {
                        'health':0,
                        'lasthealer':false,
                        'lastkiller':false					
                    };
                }
			});
            
            // Work out mafia assasinations (done by votes by mafia)
            {
                // First build a table, see who was voted the most
                var mafCounts = {}, maxTargetVotes = -1;
                _this.actionData.eliminate.forEach(function(mv){
                    mafCounts[mv.target1] = typeof mafCounts[mv.target1] == "undefined" ? 0 : mafCounts[mv.target1]+1;
                    if(mafCounts[mv.target1] > maxTargetVotes)
                    {
                        maxTargetVotes = mafCounts[mv.target1];
                    }
                });                
                // create a list of all targets that recieved the same max number of votes
                var possibleTargets = Object.keys(mafCounts).filter(function(target){return mafCounts[target] >= maxTargetVotes;});
                // Randomly choose one target, randomly choose one source from all mafioso or godfather (if no mafioso)
                maf.utils.shuffle(possibleTargets);
                var randomChoice = possibleTargets.pop();
                _this.actionData.eliminate = [];
                if(randomChoice)
                {
                    var aliveMafioso = Object.keys(_this.players).filter(function(uid){return allDeaths.indexOf(uid) == -1 && _this.players[uid].role == 3;});
                    maf.utils.shuffle(aliveMafioso);
                    var aliveGodfathers = Object.keys(_this.players).filter(function(uid){return allDeaths.indexOf(uid) == -1 && _this.players[uid].role == 4;});  
                    maf.utils.shuffle(aliveGodfathers);              
                    _this.actionData.eliminate.push({
                        'source1':aliveMafioso.length > 0 ? aliveMafioso.pop() : aliveGodfathers.pop(),
                        'target1':randomChoice,
                        'target2':-1,
                        'type':3
                    });
                }
            }
			
			// Target Switches & Role Blocks (Witch, Bus Driver, Escort, Consort)
			{
                // Bus driver
                
                var allActions = Array.prototype.concat.apply([], 
                        maf.globals.gameConfig.roleactions
                            .filter(function(k){return !!maf.globals.gameConfig.roleactions[k.actionid].targetswappable;})
                            .map(function(k){return _this.actionData[maf.globals.gameConfig.roleactions[k.actionid].displayid];})
                    );          
                if(_this.actionData.drive.length > 0)
                {
					maf.log("ability-roleblock: game=", _this.gameid, 'drives=',JSON.stringify(_this.actionData.drive) ,
                        ' beforedrives=', JSON.stringify(allActions), maf.loglevel.VERBOSE);
                }
                _this.actionData.drive.forEach(function(driveA)
                {
                    if(driveA.target1 == driveA.target2)return;
                    var target1Actions = allActions.filter(function(a){return a.target1 == driveA.target1;});
                    var target2Actions = allActions.filter(function(a){return a.target1 == driveA.target2;});
                    target1Actions.forEach(function(a){a.target1 = driveA.target2;});
                    target2Actions.forEach(function(a){a.target1 = driveA.target1;});
                });
                if(_this.actionData.drive.length > 0)
                {
					maf.log("ability-roleblock: game=", _this.gameid, 'drives=',JSON.stringify(_this.actionData.drive) ,
                        ' beforedrives=', JSON.stringify(allActions), maf.loglevel.VERBOSE);
                }
                
				// Escort Action-block
				var actions, targetAction;
				_this.actionData.distract.concat(_this.actionData.entertain).forEach(function(actionblock)
				{
					maf.log("ability-roleblock: game=", _this.gameid, ' actionblock=', JSON.stringify(actionblock), maf.loglevel.VERBOSE);
					// Loop around all actions that arent in blacklist, if any have the same source as the escorts target, remove these actions.
                    maf.globals.gameConfig.roleactions.forEach(function(ra){
						if(!ra.blockable)return;
						actions = _this.actionData[ra.displayid];
						targetAction = actions.filter(function(action){return actionblock.target1 == action.source1;}).pop();
						if(targetAction){
							actions.splice(actions.indexOf(targetAction), 1);
							_this.action_private_messages.push({
								receiver: targetAction.target1,
								chat: [targetAction.blocktype==0? "servermessages.player_blocked1_chat" : "servermessages.player_blocked2_chat"],
								attached_deathids:false
							});
							return;
						}
					});
				});
			}
			
			// BulletProof Vests & Doctor heal
			{
			// Vest（対象なしは=自分に付与）
			_this.actionData.vest.forEach(function (vestA) {
				try {
				maf.log("ability-vest: game=", _this.gameid, " vest=", JSON.stringify(vestA), maf.loglevel.VERBOSE);

				const gameLike = { players: runningPlayerState };
				const src = resolvePlayer(gameLike, vestA.source1);
				const tgt = resolvePlayer(gameLike, vestA.target1) || src; // -1/未指定なら自分へ

				if (!tgt) {
					maf.log("ability-vest: skip (no target, src=" + vestA.source1 + ", tgt=" + vestA.target1 + ")", maf.loglevel.DEBUG);
					return;
				}
				if (typeof tgt.health !== "number") tgt.health = 0;
				tgt.health += 1;
				tgt.lasthealer = vestA.source1;
				} catch (e) {
				maf.log("ability-vest: error " + e.toString() + " payload=" + JSON.stringify(vestA), maf.loglevel.ERROR);
				}
			});

			// Heal（対象なしはスキップ）
			_this.actionData.heal.forEach(function (healA) {
				try {
				maf.log("ability-heal: game=", _this.gameid, " heal=", JSON.stringify(healA), maf.loglevel.VERBOSE);

				const gameLike = { players: runningPlayerState };
				const tgt = resolvePlayer(gameLike, healA.target1);

				if (!tgt) {
					maf.log("ability-heal: skip (invalid target=" + healA.target1 + ")", maf.loglevel.DEBUG);
					return;
				}
				if (typeof tgt.health !== "number") tgt.health = 0;
				tgt.health += 1;
				tgt.lasthealer = healA.source1;
				} catch (e) {
				maf.log("ability-heal: error " + e.toString() + " payload=" + JSON.stringify(healA), maf.loglevel.ERROR);
				}
			});
			}
			
			// Arsonist
			{
                
			}
			
			// Killing roles act simultaneously, Bus driver, bodygaurd actions happen where applicable
			{
				// Attempted kills needs to be in order
				var allKillAttempts = [], matchingGaurdBlock;
				// Need to add each of the kill abilities, shuffle for each type,
				// BUT NOT all together!!! Will add a random element into who dies from bodygaurd defends etc
				
                // Mafia kills (always one as collective)
				allKillAttempts = allKillAttempts.concat(_this.actionData.eliminate);
			    // Jailor executes
				maf.utils.shuffle(_this.actionData.execute);
				allKillAttempts = allKillAttempts.concat(_this.actionData.execute);
                // vigilante kills
				maf.utils.shuffle(_this.actionData.martiallaw);
				allKillAttempts = allKillAttempts.concat(_this.actionData.martiallaw);
                // serial kills
				maf.utils.shuffle(_this.actionData.murder);
				allKillAttempts = allKillAttempts.concat(_this.actionData.murder);
				
				// Calculate all kill attemptes
				// Calculate all kill attemptes
				allKillAttempts.forEach(function (killAttempt) {
				try {
					const gameLike = { players: runningPlayerState };

					// bodyguard 介入（ターゲット一致時のみ）
					var matchingGaurdBlock = _this.actionData.gaurd
					.filter(function (ga) { return ga.target1 == killAttempt.target1; })
					.pop();

					if (matchingGaurdBlock) {
					maf.log(
						"ability-gaurd: game=",
						_this.gameid,
						" matchinggaurdblock=",
						JSON.stringify(matchingGaurdBlock),
						" killattempt=",
						JSON.stringify(killAttempt),
						maf.loglevel.VERBOSE
					);

					// 1回限りなので取り除く
					_this.actionData.gaurd.splice(_this.actionData.gaurd.indexOf(matchingGaurdBlock), 1);

					// 攻撃者＆ガードのプレイヤー解決
					const attacker = resolvePlayer(gameLike, killAttempt.source1);
					const guarder  = resolvePlayer(gameLike, matchingGaurdBlock.source1);

					if (!attacker || !guarder) {
						maf.log(
						"ability-gaurd: skip (attacker or guard not found) atk=" +
							killAttempt.source1 +
							" guard=" +
							matchingGaurdBlock.source1,
						maf.loglevel.DEBUG
						);
						return;
					}

					if (typeof attacker.health !== "number") attacker.health = 0;
					if (typeof guarder.health !== "number")  guarder.health  = 0;

					attacker.health -= 1;
					attacker.lastkiller = matchingGaurdBlock.source1;

					guarder.health -= 1;
					guarder.lastkiller = killAttempt.source1;

					} else {
					// 通常キル
					maf.log("ability-kill: game=", _this.gameid, " killattempt=", JSON.stringify(killAttempt), maf.loglevel.VERBOSE);

					const target = resolvePlayer(gameLike, killAttempt.target1);
					if (!target) {
						maf.log("ability-kill: skip (invalid target=" + killAttempt.target1 + ")", maf.loglevel.DEBUG);
						return;
					}
					if (typeof target.health !== "number") target.health = 0;

					target.health -= 1;
					target.lastkiller = killAttempt.source1;
					}
				} catch (e) {
					maf.log("ability-kill: error " + e.toString() + " payload=" + JSON.stringify(killAttempt), maf.loglevel.ERROR);
				}
				});				
				// Calculate kill success
				for(var victimUid in runningPlayerState)
				{
					if(runningPlayerState[victimUid].health < 0){
						maf.log("death: game=", _this.gameid, ' victim=', victimUid, ' playerhealthstate=', runningPlayerState[victimUid], maf.loglevel.VERBOSE);
						_this.action_deaths.push({
							'victim_uniqueid':victimUid,
							'deathrole': _this.players[victimUid].role,
							'linked_message':true
						});
						allDeaths.push(victimUid);
					}
				}
			}
			
			// Other actions that are independant of each other 
			{
			
				// Janitor Cleans target
			
                // Framer
                var frames = {};
                _this.actionData.frame.forEach(function(frameA)
                {
                    frames[frameA.target1] = true;
                });
            
				// Sherif
				// Sherif
				_this.actionData.interrogate.forEach(function (interrogate) {
				try {
					if (allDeaths.indexOf(interrogate.source1) != -1) return;

					const gameLike = { players: runningPlayerState };
					const tgt = resolvePlayer(gameLike, interrogate.target1);
					if (!tgt) {
					maf.log("ability-interrogate: skip (invalid target=" + interrogate.target1 + ")", maf.loglevel.DEBUG);
					return;
					}

					// 元の _this.players[...] 参照は uniqueid を使ってOK
					const targetPlayer = _this.players[interrogate.target1];
					if (!targetPlayer) {
					maf.log("ability-interrogate: skip (target not found in _this.players=" + interrogate.target1 + ")", maf.loglevel.DEBUG);
					return;
					}

					var isSuspect = false;
					if (frames[interrogate.target1]) isSuspect = true;
					else if (!!(+maf.globals.gameConfig.roles[targetPlayer.role].sheriffresult)) isSuspect = true;

					maf.log("ability-interrogate: game=", _this.gameid, 'interrogate=', JSON.stringify(interrogate), ' isSuspect=', isSuspect, maf.loglevel.VERBOSE);

					_this.action_private_messages.push({
					'receiver': interrogate.source1,
					'chat': [(isSuspect ? "servermessages.interrogate_suspect_chat" : "servermessages.interrogate_legit_chat"), interrogate.target1],
					'attached_deathids': false
					});
				} catch (e) {
					maf.log("ability-interrogate: error " + e.toString() + " payload=" + JSON.stringify(interrogate), maf.loglevel.ERROR);
				}
				});
                
                // Investigator + Consigliere
				// Investigator + Consigliere
				_this.actionData.shadow.concat(_this.actionData.research).forEach(function (investigate) {
				try {
					if (allDeaths.indexOf(investigate.source1) != -1) return;

					const gameLike = { players: runningPlayerState };
					const tgt = resolvePlayer(gameLike, investigate.target1);
					if (!tgt) {
					maf.log("ability-investigate: skip (invalid target=" + investigate.target1 + ")", maf.loglevel.DEBUG);
					return;
					}

					const targetPlayer = _this.players[investigate.target1];
					if (!targetPlayer) {
					maf.log("ability-investigate: skip (target not found in _this.players=" + investigate.target1 + ")", maf.loglevel.DEBUG);
					return;
					}

					var prefix = maf.globals.gameConfig.roles[targetPlayer.role].investigateresult;
					maf.log("ability-investigate: game=", _this.gameid, 'investigate=', JSON.stringify(investigate), ' message_prefix=', prefix, maf.loglevel.VERBOSE);

					_this.action_private_messages.push({
					'receiver': investigate.source1,
					'chat': ["servermessages.investigate_" + prefix + "_chat", investigate.target1],
					'attached_deathids': false
					});
					_this.action_private_messages.push({
					'receiver': investigate.target1,
					'chat': "servermessages.investigate_" + prefix + "_target_chat",
					'attached_deathids': false
					});
				} catch (e) {
					maf.log("ability-investigate: error " + e.toString() + " payload=" + JSON.stringify(investigate), maf.loglevel.ERROR);
				}
				});
                
			
				// Disguiser replaces if succeeded in a kill
				
				// Mason leader recruits
				
                // Jailor inprison
                var alreadyInprisoned = [];
				maf.utils.shuffle(_this.actionData.inprison);
                _this.actionData.inprison.forEach(function(inprisonA)
                {
					maf.log("ability-inprison: game=", _this.gameid, 'inprison=', JSON.stringify(inprisonA), ' alreadyInprisoned=', JSON.stringify(alreadyInprisoned), maf.loglevel.VERBOSE);
                    
                    if(alreadyInprisoned.indexOf(inprisonA.source1) != -1 || alreadyInprisoned.indexOf(inprisonA.target1) != -1)
                    {
                        _this.action_private_messages.push({
                            'receiver':inprisonA.source1,
                            'chat':["servermessages.inprisonment_source_chat_failed", inprisonA.source1],
                            'attached_deathids':false
                        });
                        return;
                    }
                
                    // imprison only works in reflection so choose next day, phase 0 for the effect
                    _this.action_effects.push({
						'effect_type': 'inprison_jailor',
						'target1': inprisonA.source1,
						'target2': inprisonA.target1,
						'playerchoice_target': inprisonA.target1,
                        'day':_this.day+1,
                        'phase':0,
                        'subscribeto':1,
                        'anonymousfrom':0
                    });   
                    _this.action_effects.push({
						'effect_type': 'inprison_jailee',
						'target1': inprisonA.target1,
						'target2': inprisonA.source1,
                        'day':_this.day+1,
                        'phase':0,
                        'subscribeto':1,
                        'anonymousfrom':1
                    }); 
                    _this.action_private_messages.push({
						'receiver':inprisonA.source1,
                        'chat':["servermessages.inprisonment_source_chat", inprisonA.source1],
						'attached_deathids':false
                    });
                    _this.action_private_messages.push({
						'receiver':inprisonA.target1,
                        'chat':"servermessages.inprisonment_target_chat",
						'attached_deathids':false
                    });
                    
                    alreadyInprisoned.push(inprisonA.source1);
                    alreadyInprisoned.push(inprisonA.target1);
                });   
                
                // Mayor reveal
                _this.actionData.mayoralreveal.forEach(function(reveal)
                {
                    _this.action_effects.push({
						'effect_type': 'votebonus',
						'target1': reveal.target1,
						'votevalue': 2,
                        'day':-1,
                        'phase':-1
                    });   
                    _this.action_public_messages.push({
                        'chat':["servermessages.mayor_reveal_chat", reveal.target1, 16],
                        'attached_reveals':[{
                            'uniqueid':reveal.target1,
                            'role':16
                        }]
                    });
                });                
                
				// Silencer silences
				// Silencer silences
				_this.actionData.silence.forEach(function (silenceA) {
				try {
					maf.log("ability-silence: game=", _this.gameid, ' silence=', JSON.stringify(silenceA), maf.loglevel.VERBOSE);

					const gameLike = { players: runningPlayerState };
					const tgt = resolvePlayer(gameLike, silenceA.target1);
					if (!tgt) {
					maf.log("ability-silence: skip (invalid target=" + silenceA.target1 + ")", maf.loglevel.DEBUG);
					return;
					}

					_this.action_effects.push({
					'effect_type': 'silence',
					'target1': silenceA.target1,
					'day': _this.day,
					'phase': -1
					});

					var pm = _this.action_private_messages.filter(function (pm) { return pm.receiver && pm.receiver == silenceA.target1 && pm.chat && pm.chat[0] == "servermessages.player_silenced_chat"; }).pop();
					if (!pm) {
					_this.action_private_messages.push({
						'receiver': silenceA.target1,
						'chat': "servermessages.player_silenced_chat",
						'attached_deathids': false
					});
					}
				} catch (e) {
					maf.log("ability-silence: error " + e.toString() + " payload=" + JSON.stringify(silenceA), maf.loglevel.ERROR);
				}
				});
			}
			
			var phaseDeaths = _this.action_deaths.map(function(d){return d.victim_uniqueid;});
			if(phaseDeaths.length==1){
				_this.action_public_messages.push({
					main:["servermessages.life_murder_single", phaseDeaths[0]],
					chat:["servermessages.life_murder_single_chat", phaseDeaths[0]],
					attached_deathids:[phaseDeaths[0]]
				});
			} else if(phaseDeaths.length>1){
				_this.action_public_messages.push({
					main:["servermessages.life_murder_multiple", phaseDeaths],
					chat:["servermessages.life_murder_multiple_chat", phaseDeaths],
					attached_deathids:phaseDeaths
				});
			}
            
			maf.log("Completed action calculations for game=", _this.gameid, 
                ' actionEffects=', JSON.stringify(_this.action_effects),
                ' privateMessages=', JSON.stringify(_this.action_private_messages),
                ' publicMessages=', JSON.stringify(_this.action_public_messages), 
                ' actionDeaths=', JSON.stringify(_this.action_deaths), maf.loglevel.NORMAL);
			
			runningPlayerState = null;
			_this.actionData = null;			
		},
		
		//////////////////////// Game Logic - Goals //////////////////////////
		// Calculate if game is going to end
		'is_game_over':function()
		{
			var _this=this,over=false,pl,alive = {town:0,mafia:0,sks:0,total:0};
			Object.keys(_this.players).forEach(function(uqid){
				pl = _this.players[uqid];
				if(pl.playerstate==1){
					switch(pl.roleinfo.goal){
						case 0:alive.town++;break;
						case 1:alive.mafia++;break;
						case 2:alive.sks++;break;
					}
					alive.total++;
				}
			
			});
			this.victors = [];
			this.victory = {};
			// if mafia alive and town dead, mafia win
			if(alive.town == 0 && alive.mafia > 0){
				this.victory.mafia = 1;
				this.victors.push('mafia');
				over = true;
			} else {
				this.victory.mafia = 0;
			}
			// if town alive and mafia dead, town win
			if(alive.mafia == 0 && alive.town > 0){
				this.victory.town = 1;
				this.victors.push('town');
				over = true;
			} else {
				this.victory.town = 0;
			}
			// Possibly no-body won :o
			if(alive.town == 0 && alive.mafia == 0){
				this.victors.push('none');
                over = true;
			}
			// Check for SK victory
			if(alive.sks > 0 && alive.sks == alive.total){	
				this.victory.sk = 1;
				over = true;
			} else {
				this.victory.sk = 0;
			}
			return over;
		},
		// These methods get called when the game has been confirmed as over ONLY
		'goals':
		{
            // Ensure victory is 0 or 1, nothing else
			// Standard Town Goal (eliminate all Mafia)
			0:function(index){
				this.players[index].victory = this.victory.town;
			},
			// Standard Mafia Goal (eliminate all Town)
			1:function(index){
				this.players[index].victory = this.victory.mafia;
			},
			// Serial Killer
			2:function(index)
			{
				this.players[index].victory = (this.players[index].playerstate == 1 && this.victory.sk) ? 1 : 0;
				if(this.players[index].victory && this.victors.indexOf(this.players[index].roleinfo.roleid) == -1)
                {
                    this.victors.push(this.players[index].roleinfo.roleid);
                }
			},
			// Jester
			3:function(index)
			{
				var mydeath = this.deaths.filter(function(d){return d.victim_uniqueid == index;}).pop();
				this.players[index].victory = (mydeath && mydeath.lynched=="true") ? 1 : 0;
				if(this.players[index].victory && this.victors.indexOf(this.players[index].roleinfo.roleid) == -1)
                {
                    this.victors.push(this.players[index].roleinfo.roleid);
                }
			},
            // Survivor
            4:function(index)
            {
				var mydeath = this.deaths.filter(function(d){return d.victim_uniqueid == index;}).pop();
				this.players[index].victory = !mydeath;
				if(this.players[index].victory && this.victors.indexOf(this.players[index].roleinfo.roleid) == -1)
                {
                    this.victors.push(this.players[index].roleinfo.roleid);
                }
            }
		},
		'post_game_goals':function(maf)
		{
			this.victoryMessage = this.victors.join(',');
			maf.log("victory: game=", this.gameid, ' victorymsg=', this.victoryMessage, maf.loglevel.VERBOSE);
		}
	};
}

module.exports.getGameLogic = getGameLogic;