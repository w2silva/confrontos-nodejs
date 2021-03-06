import _ from 'lodash'
import { success, notFound } from '../../services/response/'
import { Invitation } from '.'
import { Message } from './../message'
import { mergeInvitationAttr } from './../../services/utils/merge'

export const create = ({ bodymen: { body }, user }, res, next) =>
  Invitation.create({ ...body, user: user._id })
    .then((invitation) => {
      if (invitation && body.message && typeof body.message === 'string') {
        return Message.create({
          sender: invitation.user,
          receiver: invitation.guest_user,
          author: invitation.user,
          message: { text: body.message },
        })
        .then((message) => {
          message.setNext('chat_id', (err, doc) => {
            if(err) console.log('Cannot increment the chat id', err)
          })
          return invitation
        })
        .catch(next)
      } else {
        return invitation
      }
    })
    .then((invitation) => invitation.view(true))
    .then(success(res, 201))
    .catch(next)

export const index = ({ querymen: { query, select, cursor }, user }, res, next) =>
  Invitation.count({ ...query, $or: [{ user: user._id }, { guest_user: user._id }] })
    .then(count => Invitation.find({ ...query, $or: [{ user: user._id }, { guest_user: user._id }] }, select, cursor)
      .populate([{ 
        path: 'user', 
        select: 'display_name picture' 
      }, { 
        path: 'team', 
        select: 'display_name pictures' 
      }, {
        path: 'guest_team', 
        select: 'display_name pictures' 
      }, { 
        path: 'host_team', 
        select: 'display_name pictures' 
      }, {
        path: 'visiting_team', 
        select: 'display_name pictures' 
      },{
        path: 'match',
        select: 'home_team visiting_team'
      }])
      .then((invitations) => ({
        count,
        rows: invitations.map((invitation) => invitation.view())
      }))
    )
    .then(success(res))
    .catch(next)

export const show = ({ params, user }, res, next) =>
  Invitation.findOne({ '_id': params.id, $or: [{ user: user._id }, { guest_user: user._id }] })
    .populate([{
        path: 'user',
        select: 'display_name picture'
      }, {
       path: 'guest_user',
       select: 'display_name picture'
     }, {
        path: 'team',
        select: 'display_name pictures address'
      }, {
        path: 'guest_team',
        select: 'display_name pictures address'
      }, {
        path: 'host_team',
        select: 'display_name pictures address'
      }, {
        path: 'visiting_team',
        select: 'display_name pictures address'
      },{
        path: 'match',
        select: 'home_team visiting_team'
      }])
    .then(notFound(res))
    .then((invitation) => invitation ? invitation.view() : null)
    .then(success(res))
    .catch(next)

export const update = ({ bodymen: { body }, params, user }, res, next) =>
  Invitation.findOne({ '_id': params.id, $or: [{ user: user._id }, { guest_user: user._id }] })
    .then(notFound(res))
    .then((invitation) => invitation ? _.mergeWith(invitation, body, mergeInvitationAttr).save() : null)
    .then((invitation) => invitation ? invitation.view(true) : null)
    .then(success(res))
    .catch(next)

export const destroy = ({ params, user }, res, next) =>
  Invitation.findOne({ '_id': params.id, user: user._id })
    .then(notFound(res))
    .then((invitation) => invitation ? invitation.remove() : null)
    .then(success(res, 204))
    .catch(next)
