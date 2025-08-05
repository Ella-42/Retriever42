# **************************************************************************** #
#                                                                              #
#                                                         :::      ::::::::    #
#    Makefile                                           :+:      :+:    :+:    #
#                                                     +:+ +:+         +:+      #
#    By: lpeeters <lpeeters@student.s19.be>         +#+  +:+       +#+         #
#                                                 +#+#+#+#+#+   +#+            #
#    Created: 2024/12/18 20:28:30 by lpeeters          #+#    #+#              #
#    Updated: 2025/08/05 17:23:20 by lpeeters         ###   ########.fr        #
#                                                                              #
# **************************************************************************** #

containers = retriever webserver

define nameFilter
--filter "name=$1"
endef

statusFilter = $(foreach name, $(containers), $(call nameFilter, $(name)))
cleanFilter = --filter "label=com.docker.compose.project=Retriever"

silent = 2> /dev/null

up:
	@docker-compose -p Retriever up --build -d

down:
	@docker-compose down

status:
	@docker ps -a $(statusFilter)

webserver:
	@docker exec -it nginx sh

retriever:
	@docker exec -it retriever sh

clean:
	@docker stop $$(docker ps -qa $(cleanFilter)) $(silent); \
	 docker rm $$(docker ps -qa $(cleanFilter)) $(silent); \
	 docker rmi -f $$(docker images -qa $(cleanFilter)) $(silent); \
	 docker volume rm $$(docker volume ls -q $(cleanFilter)) $(silent); \
	 docker network rm $$(docker network ls -q $(cleanFilter)) $(silent) || true

log:
	@echo 'Webserver:'
	@docker logs webserver
	@echo ''
	@echo '-----------------------'
	@echo '------------'
	@echo ''
	@echo 'Retriever:'
	@docker logs retriever

logWebserver:
	@docker logs webserver

logRetriever:
	@docker logs retriever

reWebserver:
	@docker restart webserver

reRetriever:
	@docker restart retriever

re: down clean up

.PHONY: up down status webserver retriever log logWebserver logRetriever re reWebserver reRetriever
